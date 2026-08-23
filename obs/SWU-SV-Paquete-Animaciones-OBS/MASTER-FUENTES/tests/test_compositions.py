import sys
import subprocess
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.assets import AssetBundle
from swu_obs_anim.config import CompositionSpec, RenderManifest, load_render_manifest
from swu_obs_anim.encode import encode_frames
from swu_obs_anim.scenes.ambient import render_ambient
from swu_obs_anim.scenes.energy_frame import render_energy_frame
from swu_obs_anim.scenes.holographic_logo import render_holographic_logo
from swu_obs_anim.scenes.holding import render_holding
from swu_obs_anim.scenes.stinger import render_stinger


WIDTH = 320
HEIGHT = 180


@dataclass(frozen=True)
class ReducedContext:
    assets: AssetBundle
    manifest: RenderManifest


def reduced_context() -> ReducedContext:
    background = Image.new("RGB", (WIDTH, HEIGHT), (18, 31, 55))
    background.putpixel((10, HEIGHT // 2), (230, 25, 20))
    frame = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    # A synthetic frame deliberately crosses every protected region. The
    # renderer must clear those source pixels as well as its own effects.
    for x in range(WIDTH):
        frame.putpixel((x, 8), (35, 155, 225, 180))
        frame.putpixel((x, HEIGHT - 9), (35, 155, 225, 180))
    for y in range(HEIGHT):
        frame.putpixel((8, y), (35, 155, 225, 180))
        frame.putpixel((WIDTH - 9, y), (35, 155, 225, 180))
    frame.putpixel((WIDTH // 2, HEIGHT // 2), (35, 155, 225, 180))
    frame.putpixel((10, HEIGHT // 2), (230, 25, 20, 255))

    logo = Image.new("RGBA", (32, 32), (18, 72, 180, 255))
    for offset in range(32):
        logo.putpixel((offset, offset), (235, 245, 255, 255))
        logo.putpixel((31 - offset, offset), (68, 224, 255, 255))

    banner = Image.new("RGB", (2048, 1152), (5, 14, 34))
    banner_draw = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(banner)
    banner_draw.ellipse((910, 455, 1138, 683), fill=(25, 78, 165))
    banner_draw.ellipse((970, 515, 1078, 623), fill=(210, 235, 255))

    compositions = (
        CompositionSpec("ambient", "ambient.mp4", WIDTH, HEIGHT, 30, 60, "h264", True),
        CompositionSpec("energy-frame", "energy.webm", WIDTH, HEIGHT, 30, 60, "vp9-alpha", True),
        CompositionSpec("holographic-logo", "logo.webm", WIDTH, HEIGHT, 30, 240, "vp9-alpha", True),
        CompositionSpec("stinger", "stinger.webm", WIDTH, HEIGHT, 30, 36, "vp9-alpha", False),
        CompositionSpec("starting", "starting.mp4", WIDTH, HEIGHT, 30, 60, "h264", True),
        CompositionSpec("break", "break.mp4", WIDTH, HEIGHT, 30, 60, "h264", True),
    )
    protected = {
        "table": (70, 29, 250, 137),
        "topHud": (3, 3, 317, 29),
        "bottomHud": (3, 137, 317, 167),
    }
    return ReducedContext(
        AssetBundle({
            "camera-background": background,
            "stream-frame": frame,
            "logo-png": logo,
            "youtube-banner": banner,
        }),
        RenderManifest(compositions, protected, 17),
    )


class CompositionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = reduced_context()

    def test_ambient_loop_endpoints_are_byte_identical_rgb(self):
        first = render_ambient(0, self.context)
        last = render_ambient(59, self.context)

        self.assertEqual(first.mode, "RGB")
        self.assertEqual(first.size, (WIDTH, HEIGHT))
        self.assertEqual(first.tobytes(), last.tobytes())

    def test_ambient_changes_without_exceeding_ten_percent_mean_luminance(self):
        frames = [render_ambient(frame, self.context) for frame in (0, 15, 30, 44, 59)]
        luminances = [
            sum(value * count for value, count in enumerate(image.convert("L").histogram()))
            / (WIDTH * HEIGHT)
            for image in frames
        ]

        self.assertIsNotNone(ImageChops.difference(frames[0], frames[1]).getbbox())
        self.assertLess((max(luminances) - min(luminances)) / luminances[0], 0.10)

    def test_ambient_has_no_static_red_accents(self):
        self.assertIsNone(red_mask(render_ambient(0, self.context)).getbbox())

    def test_energy_frame_loop_endpoints_and_alpha_contract(self):
        first = render_energy_frame(0, self.context)
        last = render_energy_frame(59, self.context)

        self.assertEqual(first.mode, "RGBA")
        self.assertEqual(first.size, (WIDTH, HEIGHT))
        self.assertEqual(first.tobytes(), last.tobytes())
        alpha = first.getchannel("A")
        minimum, maximum = alpha.getextrema()
        self.assertEqual(minimum, 0)
        self.assertGreater(maximum, 0)

    def test_energy_frame_clears_all_scaled_protected_regions(self):
        image = render_energy_frame(14, self.context)
        alpha = image.getchannel("A")

        for name in ("table", "topHud", "bottomHud"):
            with self.subTest(region=name):
                self.assertEqual(alpha.crop(self.context.manifest.protected_regions[name]).getbbox(), None)

    def test_energy_frame_red_is_limited_to_nonsimultaneous_indicators(self):
        resting = render_energy_frame(0, self.context)
        first_indicator = render_energy_frame(14, self.context)
        second_indicator = render_energy_frame(45, self.context)

        self.assertIsNone(red_mask(resting).getbbox())
        self.assertLess(red_mask(first_indicator).getbbox()[2], WIDTH // 2)
        second_mask = red_mask(second_indicator)
        self.assertGreaterEqual(second_mask.getbbox()[0], WIDTH // 2)
        self.assertGreater(second_mask.histogram()[255], 4)

    def test_energy_vp9_keeps_decoded_protected_regions_exactly_transparent(self):
        spec = self.context.manifest.by_id("energy-frame")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / spec.filename
            encode_frames(spec, lambda frame: render_energy_frame(frame, self.context), output)
            decoded = subprocess.run(
                [
                    "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9",
                    "-i", str(output), "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
                ],
                check=True,
                capture_output=True,
            ).stdout

        frame_size = WIDTH * HEIGHT * 4
        self.assertEqual(len(decoded), frame_size * spec.frames)
        protected_max = {name: 0 for name in self.context.manifest.protected_regions}
        for frame in range(spec.frames):
            image = Image.frombytes(
                "RGBA",
                (WIDTH, HEIGHT),
                decoded[frame * frame_size:(frame + 1) * frame_size],
            )
            alpha = image.getchannel("A")
            for name, region in self.context.manifest.protected_regions.items():
                protected_max[name] = max(
                    protected_max[name],
                    alpha.crop(region).getextrema()[1],
                )
        self.assertEqual(protected_max, {name: 0 for name in protected_max})

    def test_holographic_logo_keeps_exact_128_square_at_fixed_position(self):
        image = render_holographic_logo(0, self.context)
        expected = self.context.assets.images["logo-png"].resize(
            (128, 128), Image.Resampling.LANCZOS
        )

        self.assertEqual(image.mode, "RGBA")
        self.assertEqual(image.size, (WIDTH, HEIGHT))
        self.assertEqual(image.crop((146, 2, 274, 130)).tobytes(), expected.tobytes())
        self.assertEqual((146, 2, 274, 130)[2] - 146, (146, 2, 274, 130)[3] - 2)

    def test_holographic_logo_does_not_deform_emblem_while_rings_rotate(self):
        expected = self.context.assets.images["logo-png"].resize(
            (128, 128), Image.Resampling.LANCZOS
        )
        for frame in (0, 60, 100, 120, 153, 180, 239):
            with self.subTest(frame=frame):
                crop = render_holographic_logo(frame, self.context).crop((146, 2, 274, 130))
                self.assertEqual(crop.getchannel("A").tobytes(), expected.getchannel("A").tobytes())

    def test_stinger_alpha_closes_covers_three_frames_and_opens(self):
        coverage = {
            frame: alpha_coverage(render_stinger(frame, self.context))
            for frame in (0, 17, 18, 19, 35)
        }

        self.assertLess(coverage[0], 0.05)
        self.assertGreaterEqual(coverage[17], 0.999)
        self.assertGreaterEqual(coverage[18], 0.999)
        self.assertGreaterEqual(coverage[19], 0.999)
        self.assertLess(coverage[35], 0.05)

    def test_stinger_covered_frames_are_dark_metal_not_white_flashes(self):
        for frame in (17, 18, 19):
            with self.subTest(frame=frame):
                image = render_stinger(frame, self.context)
                luminance = image.convert("RGB").convert("L")
                histogram = luminance.histogram()
                white_pixels = sum(histogram[235:])
                self.assertLess(white_pixels / (WIDTH * HEIGHT), 0.01)
                self.assertLess(
                    sum(value * count for value, count in enumerate(histogram))
                    / (WIDTH * HEIGHT),
                    110,
                )

    def test_starting_holding_loop_has_an_rgb_title_panel(self):
        self._assert_holding_contract("EMPEZAMOS PRONTO", 1.0)

    def test_break_holding_loop_has_an_rgb_title_panel(self):
        self._assert_holding_contract("VOLVEMOS PRONTO", 0.7)

    def _assert_holding_contract(self, title, motion_scale):
        frames = [
            render_holding(frame, self.context, title, motion_scale)
            for frame in (0, 30, 59)
        ]
        self.assertTrue(all(image.mode == "RGB" for image in frames))
        self.assertTrue(all(image.size == (WIDTH, HEIGHT) for image in frames))
        self.assertEqual(frames[0].tobytes(), frames[-1].tobytes())

        # This scaled equivalent of y=820--930 must contain the bright,
        # tracked title rather than merely the dark panel or cobalt rule.
        panel = frames[1].crop((round(WIDTH * 520 / 1920), round(HEIGHT * 820 / 1080),
                                round(WIDTH * 1400 / 1920), round(HEIGHT * 930 / 1080)))
        title_mask = panel.convert("L").point(lambda value: 255 if value >= 185 else 0)
        self.assertIsNotNone(title_mask.getbbox())


def red_mask(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    source = image.load()
    mask = Image.new("L", image.size, 0)
    target = mask.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = source[x, y]
            if alpha and red > green * 1.35 and red > blue * 1.35:
                target[x, y] = 255
    return mask


def alpha_coverage(image: Image.Image, threshold: int = 1) -> float:
    histogram = image.getchannel("A").histogram()
    return sum(histogram[threshold:]) / (image.width * image.height)


class FullHoldingCompositionTests(unittest.TestCase):
    """The actual delivery-resolution contract, separate from fast unit tests."""

    @classmethod
    def setUpClass(cls):
        banner_path = (
            ROOT / "assets" / "original" / "SWU-SV-YouTube-Banner-2048x1152.png"
        )
        with Image.open(banner_path) as banner:
            banner.load()
            cls.banner = banner.copy()
        cls.context = ReducedContext(
            AssetBundle({"youtube-banner": cls.banner}),
            load_render_manifest(ROOT / "render-manifest.json"),
        )

    def test_full_resolution_holding_variants_close_and_keep_logo_untouched(self):
        reference = self.banner.resize((1920, 1080), Image.Resampling.LANCZOS)
        # The source badge at the centre is deliberately kept byte-for-byte
        # untouched; orbital effects are clipped before reaching this core.
        logo_box = (900, 488, 1020, 608)
        for title, motion_scale, final_frame in (
            ("EMPEZAMOS PRONTO", 1.0, 599),
            ("VOLVEMOS PRONTO", 0.7, 599),
        ):
            with self.subTest(title=title):
                frames = [
                    render_holding(frame, self.context, title, motion_scale)
                    for frame in (0, 300, final_frame)
                ]
                self.assertTrue(all(image.mode == "RGB" for image in frames))
                self.assertTrue(all(image.size == (1920, 1080) for image in frames))
                self.assertEqual(frames[0].tobytes(), frames[-1].tobytes())
                self.assertEqual(frames[1].crop(logo_box).tobytes(), reference.crop(logo_box).tobytes())

                panel = frames[1].crop((520, 820, 1400, 930))
                title_mask = panel.convert("L").point(lambda value: 255 if value >= 185 else 0)
                self.assertIsNotNone(title_mask.getbbox())

    def test_full_resolution_holding_seam_energy_is_continuous(self):
        for title, motion_scale in (
            ("EMPEZAMOS PRONTO", 1.0),
            ("VOLVEMOS PRONTO", 0.7),
        ):
            with self.subTest(title=title):
                frames = {
                    frame: render_holding(frame, self.context, title, motion_scale)
                    for frame in (0, 596, 597, 598, 599)
                }
                self.assertEqual(frames[0].tobytes(), frames[599].tobytes())
                neighbor_steps = (
                    mean_frame_delta(frames[596], frames[597]),
                    mean_frame_delta(frames[597], frames[598]),
                )
                seam_step = mean_frame_delta(frames[598], frames[599])
                self.assertLessEqual(
                    seam_step,
                    1.5 * max(neighbor_steps),
                    msg=(
                        f"seam={seam_step:.6f}, "
                        f"neighbors={[round(step, 6) for step in neighbor_steps]}"
                    ),
                )


def mean_frame_delta(first: Image.Image, second: Image.Image) -> float:
    difference = ImageChops.difference(first, second).convert("L")
    return sum(value * count for value, count in enumerate(difference.histogram())) / (
        first.width * first.height
    )


if __name__ == "__main__":
    unittest.main()
