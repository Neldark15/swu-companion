#!/bin/sh
set -eu
SWU_OBS_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec python3 "$SWU_OBS_ROOT/render.py" "$@"
