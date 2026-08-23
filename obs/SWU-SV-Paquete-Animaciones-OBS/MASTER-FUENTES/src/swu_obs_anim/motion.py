from dataclasses import dataclass
import math
import random


@dataclass(frozen=True)
class Star:
    x: float
    y: float
    radius: float
    alpha: int


def loop_phase(frame: int, frame_count: int) -> float:
    if frame_count < 2 or frame < 0 or frame >= frame_count:
        raise ValueError("frame outside composition")
    return frame / (frame_count - 1)


def timeline_progress(frame: int, frame_count: int) -> float:
    if frame_count < 1 or frame < 0 or frame >= frame_count:
        raise ValueError("frame outside composition")
    return frame / max(1, frame_count - 1)


def ease_in_out_cubic(value: float) -> float:
    value = min(1.0, max(0.0, value))
    return 4 * value ** 3 if value < 0.5 else 1 - ((-2 * value + 2) ** 3) / 2


def periodic_offset(phase: float, amplitude: float, cycles: float = 1.0) -> float:
    return math.sin(phase * math.tau * cycles) * amplitude


def pulse_window(phase: float, center: float, width: float) -> float:
    distance = abs(((phase - center + 0.5) % 1.0) - 0.5)
    if distance >= width / 2:
        return 0.0
    normalized = 1.0 - distance / (width / 2)
    return normalized * normalized * (3 - 2 * normalized)


def seeded_stars(
    seed: int, count: int, bounds: tuple[int, int, int, int]
) -> tuple[Star, ...]:
    rng = random.Random(seed)
    x0, y0, x1, y1 = bounds
    return tuple(
        Star(
            rng.uniform(x0, x1),
            rng.uniform(y0, y1),
            rng.uniform(0.6, 2.0),
            rng.randint(35, 145),
        )
        for _ in range(count)
    )
