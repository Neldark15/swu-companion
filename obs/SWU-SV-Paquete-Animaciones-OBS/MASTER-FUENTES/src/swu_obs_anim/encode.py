from pathlib import Path
import subprocess


def ffmpeg_args(spec, output: Path) -> list[str]:
    alpha = spec.profile == "vp9-alpha"
    input_pixel_format = "rgba" if alpha else "rgb24"
    base = [
        "ffmpeg", "-y", "-v", "error", "-f", "rawvideo",
        "-pix_fmt", input_pixel_format, "-s", f"{spec.width}x{spec.height}",
        "-framerate", str(spec.fps), "-i", "pipe:0",
        "-frames:v", str(spec.frames), "-an",
    ]
    if alpha:
        codec = [
            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
            "-b:v", "0", "-crf", "18", "-deadline", "good",
            "-cpu-used", "2", "-row-mt", "1", "-tile-columns", "2",
            "-auto-alt-ref", "0", "-g", "60",
            "-metadata:s:v:0", "alpha_mode=1",
        ]
    else:
        codec = [
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-fps_mode", "cfr",
            "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
            "-movflags", "+faststart", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-colorspace", "bt709",
            "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
        ]
    return base + codec + [str(output)]


def encode_frames(spec, render_frame, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    mode = "RGBA" if spec.profile == "vp9-alpha" else "RGB"
    process = subprocess.Popen(ffmpeg_args(spec, output), stdin=subprocess.PIPE)
    failure = None
    try:
        for frame in range(spec.frames):
            image = render_frame(frame)
            if image.size != (spec.width, spec.height):
                raise ValueError(f"wrong frame size at {frame}: {image.size}")
            process.stdin.write(image.convert(mode).tobytes())
    except BaseException as error:
        failure = error
        raise
    finally:
        _close_and_reap(process, failure, f"ffmpeg failed for {spec.id}")


def encode_prores_backup(spec, render_frame, output: Path) -> None:
    args = [
        "ffmpeg", "-y", "-v", "error", "-f", "rawvideo",
        "-pix_fmt", "rgba", "-s", f"{spec.width}x{spec.height}",
        "-framerate", str(spec.fps), "-i", "pipe:0",
        "-frames:v", str(spec.frames), "-an", "-c:v", "prores_ks",
        "-profile:v", "4", "-pix_fmt", "yuva444p10le",
        "-alpha_bits", "16", str(output),
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    process = subprocess.Popen(args, stdin=subprocess.PIPE)
    failure = None
    try:
        for frame in range(spec.frames):
            process.stdin.write(render_frame(frame).convert("RGBA").tobytes())
    except BaseException as error:
        failure = error
        raise
    finally:
        _close_and_reap(process, failure, f"ProRes backup failed for {spec.id}")


def _close_and_reap(process, failure, error_message: str) -> None:
    close_error = None
    try:
        if process.stdin:
            process.stdin.close()
    except BaseException as error:
        close_error = error

    wait_error = None
    try:
        return_code = process.wait()
    except BaseException as error:
        return_code = None
        wait_error = error

    if failure is not None:
        if close_error is not None:
            failure.add_note(f"ffmpeg stdin close failed: {close_error}")
        if wait_error is not None:
            failure.add_note(f"ffmpeg wait failed: {wait_error}")
        elif return_code != 0:
            failure.add_note(f"ffmpeg exited with status {return_code}")
        return

    if close_error is not None:
        if wait_error is not None:
            close_error.add_note(f"ffmpeg wait failed: {wait_error}")
        elif return_code != 0:
            close_error.add_note(f"ffmpeg exited with status {return_code}")
        raise close_error
    if wait_error is not None:
        raise wait_error
    if return_code != 0:
        raise RuntimeError(error_message)
