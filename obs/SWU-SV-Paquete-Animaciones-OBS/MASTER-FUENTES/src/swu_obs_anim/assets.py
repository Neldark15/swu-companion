from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
import shutil
from typing import TYPE_CHECKING

from .config import SourceManifest

if TYPE_CHECKING:
    from PIL import Image


CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True)
class AssetBundle:
    images: dict[str, Image.Image]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        while chunk := source_file.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def verify_and_copy_sources(manifest: SourceManifest, output_directory: Path) -> AssetBundle:
    from PIL import Image

    for source in manifest.sources:
        if _sha256(source.path) != source.sha256:
            raise ValueError(f"source hash mismatch: {source.id}")

    original_directory = output_directory / "assets" / "original"
    original_directory.mkdir(parents=True, exist_ok=True)
    images = {}
    for source in manifest.sources:
        copied_path = original_directory / source.copy_as
        shutil.copyfile(source.path, copied_path)
        with Image.open(copied_path) as image:
            image.load()
            images[source.id] = image.copy()
    return AssetBundle(images)


def verified_original_paths(
    manifest: SourceManifest, renderer_root: Path
) -> dict[str, Path] | None:
    """Return packaged originals only when all six bytes match their pins."""
    original_directory = renderer_root / "assets" / "original"
    paths = {
        source.id: original_directory / source.copy_as for source in manifest.sources
    }
    try:
        if all(
            path.is_file() and _sha256(path) == source.sha256
            for source in manifest.sources
            for path in (paths[source.id],)
        ):
            return paths
    except OSError:
        pass
    return None


def load_or_copy_sources(
    manifest: SourceManifest, renderer_root: Path
) -> AssetBundle:
    """Load verified packaged bytes read-only, otherwise stage pinned sources."""
    from PIL import Image

    paths = verified_original_paths(manifest, renderer_root)
    if paths is None:
        return verify_and_copy_sources(manifest, renderer_root)

    images = {}
    for source in manifest.sources:
        with Image.open(paths[source.id]) as image:
            image.load()
            images[source.id] = image.copy()
    return AssetBundle(images)
