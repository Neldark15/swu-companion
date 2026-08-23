"""Composition renderer registry."""

from .config import COMPOSITION_IDS
from .scenes.ambient import render_ambient
from .scenes.energy_frame import render_energy_frame
from .scenes.holographic_logo import render_holographic_logo
from .scenes.holding import render_holding
from .scenes.preview import render_preview
from .scenes.stinger import render_stinger


def _render_starting(frame, context):
    return render_holding(frame, context, "EMPEZAMOS PRONTO", 1.0)


def _render_break(frame, context):
    return render_holding(frame, context, "VOLVEMOS PRONTO", 0.7)


RENDERERS = {
    "ambient": render_ambient,
    "energy-frame": render_energy_frame,
    "holographic-logo": render_holographic_logo,
    "stinger": render_stinger,
    "starting": _render_starting,
    "break": _render_break,
    "preview": render_preview,
}

_configured_ids = set(COMPOSITION_IDS)
_registered_ids = set(RENDERERS)
if len(_configured_ids) != len(COMPOSITION_IDS):
    raise RuntimeError("composition IDs must be unique")
if _registered_ids != _configured_ids:
    missing = sorted(_configured_ids - _registered_ids)
    extra = sorted(_registered_ids - _configured_ids)
    raise RuntimeError(
        f"renderer registry does not match composition IDs; "
        f"missing={missing}, extra={extra}"
    )
