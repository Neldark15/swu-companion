from dataclasses import dataclass
from pathlib import Path
import json


COMPOSITION_IDS = (
    "ambient",
    "energy-frame",
    "holographic-logo",
    "stinger",
    "starting",
    "break",
    "preview",
)
SOURCE_IDS = (
    "logo-png",
    "youtube-banner",
    "camera-background",
    "stream-frame",
    "stream-logo",
    "stream-background",
)


@dataclass(frozen=True)
class CompositionSpec:
    id: str
    filename: str
    width: int
    height: int
    fps: int
    frames: int
    profile: str
    loop: bool


@dataclass(frozen=True)
class RenderManifest:
    compositions: tuple[CompositionSpec, ...]
    protected_regions: dict[str, tuple[int, int, int, int]]
    stinger_transition_frame: int

    def by_id(self, composition_id: str) -> CompositionSpec:
        matches = [item for item in self.compositions if item.id == composition_id]
        if len(matches) != 1:
            raise KeyError(composition_id)
        return matches[0]


@dataclass(frozen=True)
class SourceSpec:
    id: str
    path: Path
    copy_as: str
    sha256: str


@dataclass(frozen=True)
class SourceManifest:
    sources: tuple[SourceSpec, ...]


def load_render_manifest(path: Path) -> RenderManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    specs = tuple(CompositionSpec(**item) for item in raw["compositions"])
    if len({item.id for item in specs}) != len(specs):
        raise ValueError("duplicate composition id")
    if {item.id for item in specs} != set(COMPOSITION_IDS) or len(specs) != len(
        COMPOSITION_IDS
    ):
        raise ValueError(
            f"composition ids must be exactly: {', '.join(COMPOSITION_IDS)}"
        )
    if len({item.filename for item in specs}) != len(specs):
        raise ValueError("duplicate output filename")
    regions = {key: tuple(value) for key, value in raw["protectedRegions"].items()}
    return RenderManifest(specs, regions, int(raw["stingerTransitionFrame"]))


def load_source_manifest(path: Path) -> SourceManifest:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("source manifest must be an object")
    if type(raw.get("schemaVersion")) is not int or raw["schemaVersion"] != 1:
        raise ValueError("source manifest schemaVersion must be integer 1")
    items = raw.get("sources")
    if not isinstance(items, list):
        raise ValueError("source manifest sources must be a list")

    specs = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"source entry {index} must be an object")
        values = {}
        for key in ("id", "path", "copyAs", "sha256"):
            value = item.get(key)
            if not isinstance(value, str) or not value:
                raise ValueError(f"source entry {index} {key} must be a nonempty string")
            values[key] = value

        source_path = Path(values["path"])
        if not source_path.is_absolute():
            raise ValueError(f"source entry {index} path must be absolute")
        copy_as_path = Path(values["copyAs"])
        if (
            copy_as_path.name != values["copyAs"]
            or values["copyAs"] in (".", "..")
            or "\\" in values["copyAs"]
        ):
            raise ValueError(f"source entry {index} copyAs must be a filename")
        digest = values["sha256"]
        if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
            raise ValueError(f"source entry {index} sha256 must be 64 lowercase hex characters")
        specs.append(
            SourceSpec(
                id=values["id"],
                path=source_path,
                copy_as=values["copyAs"],
                sha256=digest,
            )
        )

    ids = [item.id for item in specs]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate source id")
    if set(ids) != set(SOURCE_IDS) or len(ids) != len(SOURCE_IDS):
        raise ValueError(f"source ids must be exactly: {', '.join(SOURCE_IDS)}")
    copy_destinations = [item.copy_as.casefold() for item in specs]
    if len(copy_destinations) != len(set(copy_destinations)):
        raise ValueError("duplicate source copyAs destination")
    return SourceManifest(tuple(specs))
