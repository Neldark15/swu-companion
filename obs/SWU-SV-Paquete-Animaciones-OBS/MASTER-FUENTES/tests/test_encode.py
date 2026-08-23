import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.config import CompositionSpec
import swu_obs_anim.encode as encode
from swu_obs_anim.encode import encode_frames, encode_prores_backup, ffmpeg_args


def spec(profile: str) -> CompositionSpec:
    return CompositionSpec(
        id=f"smoke-{profile}",
        filename=f"smoke.{ 'webm' if profile == 'vp9-alpha' else 'mp4'}",
        width=64,
        height=36,
        fps=24,
        frames=4,
        profile=profile,
        loop=False,
    )


class EncodeTests(unittest.TestCase):
    def test_h264_arguments_use_bt709_and_no_audio(self):
        args = ffmpeg_args(spec("h264"), Path("out.mp4"))

        self.assertIn("libx264", args)
        self.assertIn("yuv420p", args)
        self.assertEqual(args[args.index("-color_primaries") + 1], "bt709")
        self.assertEqual(args[args.index("-color_trc") + 1], "bt709")
        self.assertEqual(args[args.index("-colorspace") + 1], "bt709")
        self.assertIn("-an", args)

    def test_vp9_alpha_arguments_preserve_alpha(self):
        args = ffmpeg_args(spec("vp9-alpha"), Path("out.webm"))

        self.assertIn("libvpx-vp9", args)
        self.assertIn("yuva420p", args)
        self.assertEqual(args[args.index("-auto-alt-ref") + 1], "0")
        self.assertEqual(args[args.index("-metadata:s:v:0") + 1], "alpha_mode=1")

    def test_h264_smoke_encode_has_one_video_stream_without_audio(self):
        composition = spec("h264")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / composition.filename
            encode_frames(composition, lambda frame: Image.new("RGB", (64, 36), (frame, 0, 0)), output)
            stream = probe_video(output)

        self.assertEqual(stream["codec_type"], "video")
        self.assertEqual(stream["width"], 64)
        self.assertEqual(stream["height"], 36)
        self.assertEqual(stream["nb_read_frames"], "4")
        self.assertEqual(stream["color_space"], "bt709")
        self.assertEqual(stream["color_primaries"], "bt709")
        self.assertEqual(stream["color_transfer"], "bt709")

    def test_vp9_alpha_smoke_encode_has_four_rgba_frames(self):
        composition = spec("vp9-alpha")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / composition.filename
            encode_frames(
                composition,
                lambda frame: Image.new("RGBA", (64, 36), (0, frame, 255, frame * 64)),
                output,
            )
            stream = probe_video(output)
            decoded = decode_first_rgba_frame(output)

        self.assertEqual(stream["codec_type"], "video")
        self.assertEqual(stream["width"], 64)
        self.assertEqual(stream["height"], 36)
        self.assertEqual(stream["nb_read_frames"], "4")
        self.assertEqual({key.upper(): value for key, value in stream["tags"].items()}["ALPHA_MODE"], "1")
        self.assertLess(decoded[3], 255)

    def test_render_error_reaps_ffmpeg_and_preserves_original_error(self):
        process = FakeProcess()

        with patch.object(encode.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(ValueError, "render failed") as raised:
                encode_frames(spec("h264"), lambda frame: (_ for _ in ()).throw(ValueError("render failed")), Path("out.mp4"))

        self.assertTrue(process.stdin.closed)
        self.assertEqual(process.wait_calls, 1)
        self.assertIn("ffmpeg exited with status 1", "\n".join(getattr(raised.exception, "__notes__", ())))

    def test_broken_pipe_reaps_ffmpeg_and_preserves_original_error(self):
        process = FakeProcess(write_error=BrokenPipeError("encoder exited"))

        with patch.object(encode.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(BrokenPipeError, "encoder exited") as raised:
                encode_frames(spec("h264"), lambda frame: Image.new("RGB", (64, 36)), Path("out.mp4"))

        self.assertTrue(process.stdin.closed)
        self.assertEqual(process.wait_calls, 1)
        self.assertIn("ffmpeg exited with status 1", "\n".join(getattr(raised.exception, "__notes__", ())))

    def test_prores_render_error_reaps_ffmpeg_and_preserves_original_error(self):
        process = FakeProcess()

        with patch.object(encode.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(ValueError, "render failed") as raised:
                encode_prores_backup(spec("vp9-alpha"), lambda frame: (_ for _ in ()).throw(ValueError("render failed")), Path("out.mov"))

        self.assertTrue(process.stdin.closed)
        self.assertEqual(process.wait_calls, 1)
        self.assertIn("ffmpeg exited with status 1", "\n".join(getattr(raised.exception, "__notes__", ())))

    def test_prores_broken_pipe_reaps_ffmpeg_and_preserves_original_error(self):
        process = FakeProcess(write_error=BrokenPipeError("encoder exited"))

        with patch.object(encode.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(BrokenPipeError, "encoder exited") as raised:
                encode_prores_backup(spec("vp9-alpha"), lambda frame: Image.new("RGBA", (64, 36)), Path("out.mov"))

        self.assertTrue(process.stdin.closed)
        self.assertEqual(process.wait_calls, 1)
        self.assertIn("ffmpeg exited with status 1", "\n".join(getattr(raised.exception, "__notes__", ())))


def probe_video(path: Path) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    streams = json.loads(result.stdout)["streams"]
    if len(streams) != 1:
        raise AssertionError(f"expected one stream, got {streams}")
    return streams[0]


def decode_first_rgba_frame(path: Path) -> bytes:
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", str(path), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
        check=True,
        capture_output=True,
    )
    return result.stdout


class FakeInput:
    def __init__(self, write_error=None):
        self.closed = False
        self.write_error = write_error

    def write(self, data):
        if self.write_error:
            raise self.write_error
        return len(data)

    def close(self):
        self.closed = True


class FakeProcess:
    def __init__(self, write_error=None):
        self.stdin = FakeInput(write_error)
        self.returncode = None
        self.wait_calls = 0

    def wait(self):
        self.wait_calls += 1
        self.returncode = 1
        return self.returncode


if __name__ == "__main__":
    unittest.main()
