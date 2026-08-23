"""Transactional assembly of the validated SWU SV OBS delivery package."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile

from .config import RenderManifest, load_source_manifest


README_NAME = "LEEME-Animaciones-OBS.md"
FILE_MANIFEST_NAME = "MANIFIESTO-Archivos.txt"
CHECKSUM_NAME = "SHA256SUMS.txt"
MASTER_NAME = "MASTER-FUENTES"
REVIEW_NAME = "REVISION-VISUAL"
BACKUP_NAME = "RESPALDO-COMPATIBILIDAD"
VALIDATION_NAME = "validation-report.json"
CHECKPOINT_PREFIX = "work/swu-animation-renderer/"
SUPPORT_TARGETS = (
    README_NAME,
    FILE_MANIFEST_NAME,
    MASTER_NAME,
    BACKUP_NAME,
    CHECKSUM_NAME,
)
ROOT_MASTER_FILES = (
    "render.py",
    "render.sh",
    "render-manifest.json",
    "source-manifest.json",
    "requirements.txt",
    *(f"CHECKPOINT-{number:02d}.sha256" for number in range(1, 10)),
)
PURPOSES = {
    "ambient": "fondo ambiental continuo de partida",
    "energy-frame": "marco energético transparente sobre la cámara",
    "holographic-logo": "logo holográfico transparente",
    "stinger": "transición de portal entre escenas",
    "starting": "pantalla de espera «EMPEZAMOS PRONTO»",
    "break": "pantalla de pausa «VOLVEMOS PRONTO»",
    "preview": "vista previa de todo el paquete",
}


@dataclass(frozen=True)
class PackageResult:
    output_directory: Path
    checksummed_files: tuple[str, ...]


@dataclass(frozen=True)
class _PublishedTarget:
    path: Path
    device: int
    inode: int
    file_type: int


def package_delivery(
    manifest: RenderManifest,
    renderer_root: Path,
    output_directory: Path,
) -> PackageResult:
    """Populate support files only after the validated media contract passes."""
    renderer_root = Path(renderer_root)
    output_directory = Path(output_directory)
    if not output_directory.is_dir():
        raise ValueError(f"package output directory must already exist: {output_directory}")

    media_paths = _require_manifest_media(manifest, output_directory)
    media_hashes = {path.name: _sha256(path) for path in media_paths}
    _require_passing_validation(manifest, output_directory, media_hashes)
    _require_visual_review(output_directory)
    existing_support = [
        name for name in SUPPORT_TARGETS if _entry_exists(output_directory / name)
    ]
    if existing_support:
        raise FileExistsError(
            "package support already exists; refusing to overwrite: "
            + ", ".join(existing_support)
        )

    stage = Path(
        tempfile.mkdtemp(
            prefix=f".{output_directory.name}-package-", dir=output_directory.parent
        )
    )
    published = []
    try:
        _write_text(stage / README_NAME, _readme_text())
        _write_text(stage / FILE_MANIFEST_NAME, _file_manifest_text(manifest))
        _build_master(renderer_root, stage / MASTER_NAME)
        backup = stage / BACKUP_NAME
        backup.mkdir()
        _write_text(backup / "NO-REQUERIDO.txt", _compatibility_text())

        for name in SUPPORT_TARGETS[:-1]:
            published.append(
                _publish_noclobber(stage / name, output_directory / name)
            )

        _assert_media_unchanged(media_hashes, output_directory)
        package_files = _package_files(output_directory)
        checksum_path = output_directory / CHECKSUM_NAME
        staged_checksum = stage / CHECKSUM_NAME
        _write_checksum_file(package_files, output_directory, staged_checksum)
        published.append(_publish_noclobber(staged_checksum, checksum_path))
        verified = verify_package_checksums(output_directory, checksum_path)
        _assert_media_unchanged(media_hashes, output_directory)
        return PackageResult(output_directory, verified)
    except BaseException:
        for target in reversed(published):
            _remove_published(target)
        raise
    finally:
        shutil.rmtree(stage, ignore_errors=True)


def verify_package_checksums(
    output_directory: Path, checksum_path: Path | None = None
) -> tuple[str, ...]:
    """Verify every deterministic checksum line and the exact package file set."""
    output_directory = Path(output_directory)
    checksum_path = Path(checksum_path or output_directory / CHECKSUM_NAME)
    try:
        lines = checksum_path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise ValueError(f"checksum file is unavailable: {error}") from error
    expected_paths = [
        path.relative_to(output_directory).as_posix()
        for path in _package_files(output_directory)
    ]
    seen = []
    for line in lines:
        if line.count("  ") != 1:
            raise ValueError(f"invalid checksum line: {line!r}")
        digest, relative = line.split("  ", 1)
        if len(digest) != 64 or any(
            character not in "0123456789abcdef" for character in digest
        ):
            raise ValueError(f"invalid checksum digest for {relative!r}")
        path = _safe_package_path(output_directory, relative)
        if _sha256(path) != digest:
            raise ValueError(f"checksum mismatch: {relative}")
        seen.append(relative)
    if seen != expected_paths:
        raise ValueError("checksum paths do not exactly match package files")
    return tuple(seen)


def _require_manifest_media(
    manifest: RenderManifest, output_directory: Path
) -> tuple[Path, ...]:
    filenames = [spec.filename for spec in manifest.compositions]
    if len(filenames) != 7 or len({name.casefold() for name in filenames}) != 7:
        raise ValueError("render manifest must define seven unique media filenames")
    paths = []
    missing = []
    for filename in filenames:
        if Path(filename).name != filename or filename in {".", ".."} or "\\" in filename:
            raise ValueError(f"unsafe manifest media filename: {filename!r}")
        path = output_directory / filename
        try:
            status = path.lstat()
        except FileNotFoundError:
            missing.append(filename)
            continue
        if stat.S_ISLNK(status.st_mode) or not stat.S_ISREG(status.st_mode):
            raise ValueError(f"manifest media must be a regular non-symlink file: {filename}")
        paths.append(path)
    if missing:
        raise ValueError(f"missing manifest media: {', '.join(missing)}")
    return tuple(paths)


def _entry_exists(path: Path) -> bool:
    try:
        Path(path).lstat()
    except FileNotFoundError:
        return False
    return True


def _require_passing_validation(
    manifest: RenderManifest,
    output_directory: Path,
    media_hashes: dict[str, str],
) -> dict:
    report_path = output_directory / VALIDATION_NAME
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"validation report is unavailable or invalid: {error}") from error
    if not isinstance(report, dict) or report.get("ok") is not True:
        raise ValueError("validation report top-level ok must be true")
    assets = report.get("assets")
    if not isinstance(assets, list) or len(assets) != len(manifest.compositions):
        raise ValueError("validation report must contain exactly seven assets")
    expected_ids = {spec.id for spec in manifest.compositions}
    passed_ids = {
        asset.get("id")
        for asset in assets
        if isinstance(asset, dict) and asset.get("ok") is True
    }
    if passed_ids != expected_ids or len(passed_ids) != len(assets):
        raise ValueError("validation report must contain seven distinct passing assets")
    by_id = {asset["id"]: asset for asset in assets}
    for spec in manifest.compositions:
        asset = by_id[spec.id]
        if asset.get("filename") != spec.filename:
            raise ValueError(
                f"validation filename does not match manifest for {spec.id}"
            )
        digest = asset.get("sha256")
        if (
            not isinstance(digest, str)
            or len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
            or digest != media_hashes[spec.filename]
        ):
            raise ValueError(
                f"validation digest does not match current media for {spec.id}"
            )
    return report


def _require_visual_review(output_directory: Path) -> None:
    review = output_directory / REVIEW_NAME
    if not review.is_dir() or review.is_symlink():
        raise ValueError("validated REVISION-VISUAL directory is missing")
    if not any(path.is_file() and not path.is_symlink() for path in review.rglob("*")):
        raise ValueError("validated REVISION-VISUAL directory is empty")


def _build_master(renderer_root: Path, master: Path) -> None:
    master.mkdir()
    copy_paths = [Path(name) for name in ROOT_MASTER_FILES]
    copy_paths.extend(
        path.relative_to(renderer_root)
        for path in sorted((renderer_root / "src").rglob("*.py"))
    )
    copy_paths.extend(
        path.relative_to(renderer_root)
        for path in sorted((renderer_root / "tests").glob("test*.py"))
    )

    source_manifest = load_source_manifest(renderer_root / "source-manifest.json")
    for source in source_manifest.sources:
        original = renderer_root / "assets" / "original" / source.copy_as
        if _sha256_regular(original) != source.sha256:
            raise ValueError(f"packaged original source hash mismatch: {source.id}")
        copy_paths.append(Path("assets") / "original" / source.copy_as)

    bundled_font = renderer_root / "assets" / "fonts" / "DIN Condensed Bold.ttf"
    if bundled_font.exists():
        copy_paths.append(Path("assets") / "fonts" / bundled_font.name)

    normalized = [path.as_posix() for path in copy_paths]
    if len({name.casefold() for name in normalized}) != len(normalized):
        raise ValueError("duplicate master source destination")
    master_allowlist = frozenset(normalized)
    for relative in sorted(copy_paths, key=lambda path: _sort_key(path.as_posix())):
        source = renderer_root / relative
        destination = master / relative
        if relative.parent == Path(".") and relative.name.startswith("CHECKPOINT-"):
            _copy_portable_checkpoint(
                renderer_root, source, destination, master_allowlist
            )
        else:
            _copy_regular(
                source,
                destination,
                executable=relative.as_posix() == "render.sh",
            )
    _verify_staged_checkpoints(master)


def _copy_regular(source: Path, destination: Path, *, executable: bool = False) -> None:
    try:
        status = source.lstat()
    except OSError as error:
        raise ValueError(f"required master source is unavailable: {source}") from error
    if stat.S_ISLNK(status.st_mode) or not stat.S_ISREG(status.st_mode):
        raise ValueError(f"master source must be a regular non-symlink file: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    destination.chmod(0o755 if executable else 0o644)


def _copy_portable_checkpoint(
    renderer_root: Path,
    source: Path,
    destination: Path,
    master_allowlist: frozenset[str],
) -> None:
    """Rewrite workspace-relative checkpoint entries for MASTER-FUENTES."""
    _sha256_regular(source)
    try:
        lines = source.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise ValueError(f"checkpoint is unavailable: {source}") from error
    portable = []
    renderer_resolved = renderer_root.resolve()
    for line in lines:
        if line.count("  ") != 1:
            raise ValueError(f"invalid checkpoint line in {source.name}: {line!r}")
        digest, checkpoint_relative = line.split("  ", 1)
        if (
            len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
        ):
            raise ValueError(f"invalid checkpoint entry in {source.name}: {line!r}")
        relative = (
            checkpoint_relative.removeprefix(CHECKPOINT_PREFIX)
            if checkpoint_relative.startswith(CHECKPOINT_PREFIX)
            else checkpoint_relative
        )
        relative_path = Path(relative)
        if (
            not relative
            or relative_path.is_absolute()
            or "\\" in relative
            or any(part in {"", ".", ".."} for part in relative_path.parts)
            or relative_path.as_posix() != relative
        ):
            raise ValueError(
                f"unsafe checkpoint path in {source.name}: {checkpoint_relative!r}"
            )
        portable_relative = relative_path.as_posix()
        if portable_relative not in master_allowlist:
            raise ValueError(
                f"checkpoint path is not in master allowlist in {source.name}: "
                f"{checkpoint_relative!r}"
            )
        referenced = renderer_root.joinpath(*relative_path.parts)
        current = renderer_root
        for part in relative_path.parts:
            current = current / part
            try:
                status = current.lstat()
            except OSError as error:
                raise ValueError(
                    f"checkpoint path is unavailable in {source.name}: "
                    f"{checkpoint_relative!r}"
                ) from error
            if stat.S_ISLNK(status.st_mode):
                raise ValueError(
                    f"symlink in checkpoint path in {source.name}: "
                    f"{checkpoint_relative!r}"
                )
        try:
            referenced.resolve(strict=True).relative_to(renderer_resolved)
        except (OSError, ValueError) as error:
            raise ValueError(
                f"unsafe checkpoint traversal in {source.name}: {checkpoint_relative!r}"
            ) from error
        if _sha256_regular(referenced) != digest:
            raise ValueError(
                f"checkpoint digest mismatch in {source.name}: {checkpoint_relative}"
            )
        portable.append(f"{digest}  {portable_relative}")
    if not portable:
        raise ValueError(f"checkpoint is empty: {source.name}")
    _write_text(destination, "\n".join(portable) + "\n")


def _verify_staged_checkpoints(master: Path) -> None:
    """Bind every portable checkpoint to the completed staged master."""
    master_resolved = master.resolve(strict=True)
    checkpoint_names = tuple(
        name for name in ROOT_MASTER_FILES if name.startswith("CHECKPOINT-")
    )
    for checkpoint_name in checkpoint_names:
        checkpoint = master / checkpoint_name
        _sha256_regular(checkpoint)
        try:
            lines = checkpoint.read_text(encoding="utf-8").splitlines()
        except OSError as error:
            raise ValueError(
                f"staged checkpoint is unavailable: {checkpoint_name}"
            ) from error
        if not lines:
            raise ValueError(f"staged checkpoint is empty: {checkpoint_name}")
        for line in lines:
            if line.count("  ") != 1:
                raise ValueError(
                    f"invalid staged checkpoint line in {checkpoint_name}: {line!r}"
                )
            digest, relative = line.split("  ", 1)
            relative_path = Path(relative)
            if (
                len(digest) != 64
                or any(character not in "0123456789abcdef" for character in digest)
                or not relative
                or relative_path.is_absolute()
                or "\\" in relative
                or any(part in {"", ".", ".."} for part in relative_path.parts)
                or relative_path.as_posix() != relative
            ):
                raise ValueError(
                    f"invalid staged checkpoint entry in {checkpoint_name}: {line!r}"
                )

            referenced = master.joinpath(*relative_path.parts)
            current = master
            for part in relative_path.parts:
                current = current / part
                try:
                    status = current.lstat()
                except OSError as error:
                    raise ValueError(
                        f"staged checkpoint path is unavailable in {checkpoint_name}: "
                        f"{relative!r}"
                    ) from error
                if stat.S_ISLNK(status.st_mode):
                    raise ValueError(
                        f"symlink in staged checkpoint path in {checkpoint_name}: "
                        f"{relative!r}"
                    )
            try:
                referenced.resolve(strict=True).relative_to(master_resolved)
            except (OSError, ValueError) as error:
                raise ValueError(
                    f"unsafe staged checkpoint traversal in {checkpoint_name}: "
                    f"{relative!r}"
                ) from error
            if _sha256_regular(referenced) != digest:
                raise ValueError(
                    f"staged checkpoint digest mismatch in {checkpoint_name}: {relative}"
                )


def _publish_noclobber(source: Path, destination: Path) -> _PublishedTarget:
    """Publish a staged regular file/tree while atomically refusing collisions."""
    source = Path(source)
    destination = Path(destination)
    status = source.lstat()
    if stat.S_ISREG(status.st_mode):
        try:
            os.link(source, destination, follow_symlinks=False)
        except FileExistsError as error:
            raise FileExistsError(
                f"package support appeared during staging; refusing to overwrite: {destination.name}"
            ) from error
        return _PublishedTarget(
            destination,
            status.st_dev,
            status.st_ino,
            stat.S_IFMT(status.st_mode),
        )
    if not stat.S_ISDIR(status.st_mode) or stat.S_ISLNK(status.st_mode):
        raise ValueError(f"staged support must be a regular file or directory: {source}")

    try:
        destination.mkdir(mode=stat.S_IMODE(status.st_mode))
    except FileExistsError as error:
        raise FileExistsError(
            f"package support appeared during staging; refusing to overwrite: {destination.name}"
        ) from error
    destination_status = destination.lstat()
    published = _PublishedTarget(
        destination,
        destination_status.st_dev,
        destination_status.st_ino,
        stat.S_IFMT(destination_status.st_mode),
    )
    try:
        for child in sorted(source.iterdir(), key=lambda path: _sort_key(path.name)):
            _publish_noclobber(child, destination / child.name)
    except BaseException:
        _remove_published(published)
        raise
    return published


def _package_files(output_directory: Path) -> tuple[Path, ...]:
    files = []
    normalized = {}
    for current, directory_names, file_names in os.walk(output_directory, followlinks=False):
        current_path = Path(current)
        for name in directory_names:
            directory = current_path / name
            if directory.is_symlink():
                raise ValueError(f"package traversal through symlink is forbidden: {directory}")
        for name in file_names:
            path = current_path / name
            relative = path.relative_to(output_directory).as_posix()
            if relative == CHECKSUM_NAME:
                continue
            safe = _safe_package_path(output_directory, relative)
            try:
                status = safe.lstat()
            except OSError as error:
                raise ValueError(f"package file is unavailable: {relative}") from error
            if stat.S_ISLNK(status.st_mode) or not stat.S_ISREG(status.st_mode):
                raise ValueError(f"package entries must be regular non-symlink files: {relative}")
            folded = relative.casefold()
            if folded in normalized:
                raise ValueError(
                    f"duplicate package path: {normalized[folded]!r} and {relative!r}"
                )
            normalized[folded] = relative
            files.append(safe)
    return tuple(
        sorted(
            files,
            key=lambda path: _sort_key(path.relative_to(output_directory).as_posix()),
        )
    )


def _safe_package_path(output_directory: Path, relative: str) -> Path:
    if not relative or "\n" in relative or "\r" in relative or "\\" in relative:
        raise ValueError(f"unsafe package path: {relative!r}")
    relative_path = Path(relative)
    if relative_path.is_absolute() or any(
        part in {"", ".", ".."} for part in relative_path.parts
    ):
        raise ValueError(f"unsafe package traversal: {relative!r}")
    candidate = output_directory.joinpath(*relative_path.parts)
    try:
        candidate.relative_to(output_directory)
    except ValueError as error:
        raise ValueError(f"unsafe package traversal: {relative!r}") from error
    return candidate


def _write_checksum_file(
    files: tuple[Path, ...], output_directory: Path, destination: Path
) -> None:
    lines = [
        f"{_sha256(path)}  {path.relative_to(output_directory).as_posix()}"
        for path in files
    ]
    _write_text(destination, "\n".join(lines) + "\n")


def _assert_media_unchanged(expected: dict[str, str], output_directory: Path) -> None:
    actual = {name: _sha256_regular(output_directory / name) for name in expected}
    if actual != expected:
        raise RuntimeError("validated media changed during packaging")


def _sha256_regular(path: Path) -> str:
    try:
        status = path.lstat()
    except OSError as error:
        raise ValueError(f"required regular file is unavailable: {path}") from error
    if stat.S_ISLNK(status.st_mode) or not stat.S_ISREG(status.st_mode):
        raise ValueError(f"required path is not a regular non-symlink file: {path}")
    return _sha256(path)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        while chunk := source_file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _write_text(destination: Path, content: str) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}-", dir=destination.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            descriptor = -1
            output.write(content)
        temporary.chmod(0o644)
        os.replace(temporary, destination)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def _remove_support(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink(missing_ok=True)


def _remove_published(target: _PublishedTarget) -> None:
    """Rollback only the filesystem object created by this transaction."""
    try:
        status = target.path.lstat()
    except FileNotFoundError:
        return
    identity = (
        status.st_dev,
        status.st_ino,
        stat.S_IFMT(status.st_mode),
    )
    if identity != (target.device, target.inode, target.file_type):
        return
    _remove_support(target.path)


def _sort_key(relative: str) -> tuple[bytes, bytes]:
    return relative.casefold().encode("utf-8"), relative.encode("utf-8")


def _readme_text() -> str:
    return """# SWU SV — guía de animaciones para OBS

## Ajustes base

- Lienzo y tamaño de cada fuente animada: 1920×1080 a 30 fps.
- Coloque cada fuente animada a pantalla completa en x=0, y=0 y bloquéela.
- Orden en vivo de abajo hacia arriba: ambient → camera → energy frame → Marcador (Browser Source existente) → holographic logo → alerts.
- Conserve la cámara en x=420, y=37, 1080×1043 y el Marcador en 1920×1080.
- La escena conserva la live URL y los datos existentes. Estos videos no sustituyen el marcador dinámico.

## Media Sources

- MP4: loop ON, restart playback when source becomes active ON, hardware decode ON y close file when inactive OFF.
- VP9 WebM: loop ON, restart playback when source becomes active ON, hardware decode OFF y close file when inactive OFF.
- Stinger: corte en frame 15 = 500 ms, preload to RAM ON, track matte OFF. Audio monitoring no aplica porque no hay audio.
- Hide rather than delete los recursos estáticos anteriores; ocúltelos para poder volver atrás.

## Transparencia y compatibilidad

Si se pierde el alfa, confirme que el archivo sea el WebM VP9 local, desactive hardware decode y retire cualquier filtro de color. Pruebe sobre gris claro y azul marino. El alfa VP9 ya fue validado automáticamente. Use ProRes 4444 únicamente si la prueba posterior de Task 10 en OBS muestra bordes negros, pérdida de transparencia o un inicio tardío del stinger; en ese caso genere solo el respaldo afectado desde MASTER-FUENTES.
"""


def _file_manifest_text(manifest: RenderManifest) -> str:
    lines = [
        "MANIFIESTO DE ARCHIVOS — SWU SV OBS",
        "",
        "Medios (un video, sin audio):",
    ]
    for spec in manifest.compositions:
        codec = (
            "H.264 / yuv420p / BT.709"
            if spec.profile == "h264"
            else "VP9 WebM con alfa"
        )
        duration = spec.frames / spec.fps
        alpha = "sí" if spec.profile == "vp9-alpha" else "no"
        loop = "sí" if spec.loop else "no"
        lines.extend(
            (
                f"- {spec.filename}",
                f"  Propósito: {PURPOSES[spec.id]}",
                f"  Códec: {codec}; duración: {duration:g} s / {spec.frames} frames; alfa: {alpha}; loop: {loop}; dimensiones/fps: {spec.width}x{spec.height}, {spec.fps} fps.",
            )
        )
    lines.extend(
        (
            "",
            "Soporte:",
            f"- {README_NAME}: configuración y solución de problemas en OBS.",
            f"- {VALIDATION_NAME}: resultado automatizado de los siete medios.",
            f"- {REVIEW_NAME}/: contactos y fotogramas para revisión visual.",
            f"- {MASTER_NAME}/: renderer, pruebas, manifiestos, fuentes originales verificadas y checkpoints reproducibles.",
            f"- {BACKUP_NAME}/NO-REQUERIDO.txt: estado del respaldo ProRes.",
            f"- {CHECKSUM_NAME}: SHA-256 de cada archivo del paquete salvo este mismo archivo.",
            "",
        )
    )
    return "\n".join(lines)


def _compatibility_text() -> str:
    return """RESPALDO PRORES NO REQUERIDO EN ESTA ETAPA

Los tres medios VP9 transparentes pasaron la validación de ALPHA_MODE=1, decodificación RGBA con libvpx-vp9, píxeles transparentes/visibles y cobertura del stinger.

ProRes 4444 se generará únicamente si la prueba posterior en OBS detecta pérdida de alfa, halos/bordes oscuros o un inicio tardío de la transición. Hasta entonces, los WebM VP9 son la entrega principal validada.
"""
