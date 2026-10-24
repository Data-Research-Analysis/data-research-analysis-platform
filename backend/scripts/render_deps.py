"""Runtime dependency bootstrap for the deliverable render scripts.

The backend image is expected to provide the Python packages these scripts
need (markdown, weasyprint, xlsxwriter). When a container is running an older
image, or the script runs under a different interpreter than the one the image
installed into, import the missing package from a per-user cache directory,
installing it there first if necessary.

Native libraries (Pango, HarfBuzz, fontconfig) cannot be installed this way.
If WeasyPrint still cannot be imported after the Python package is present,
the raised error tells the operator to rebuild the backend image.
"""

from __future__ import annotations

import importlib
import os
import subprocess
import sys
from pathlib import Path


def _cache_dir() -> Path:
    configured = os.environ.get("PLAN_PDF_DEPS_DIR")
    base = Path(configured) if configured else Path.home() / ".cache" / "plan-pdf-deps"
    base.mkdir(parents=True, exist_ok=True)
    return base


def ensure_module(module: str, package: str | None = None) -> None:
    """Import ``module``, installing ``package`` into a local cache if missing."""
    try:
        importlib.import_module(module)
        return
    except ImportError:
        pass

    cache = _cache_dir()
    cache_str = str(cache)
    if cache_str not in sys.path:
        sys.path.insert(0, cache_str)
    importlib.invalidate_caches()
    try:
        importlib.import_module(module)
        return
    except ImportError:
        pass

    package = package or module
    print(
        f"[render-deps] {package} is not available for {sys.executable}; "
        f"installing it into {cache}",
        file=sys.stderr,
    )
    try:
        subprocess.check_call(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--no-cache-dir",
                "--target",
                cache_str,
                package,
            ],
            stdout=sys.stderr,
            stderr=sys.stderr,
        )
    except Exception as exc:  # noqa: BLE001 - surface a clear operator message
        raise SystemExit(
            f"[render-deps] Could not install {package}: {exc}. "
            "Rebuild the backend image from docker/backend/Dockerfile so the "
            "render dependencies are baked in."
        ) from exc

    importlib.invalidate_caches()
    try:
        importlib.import_module(module)
    except Exception as exc:  # noqa: BLE001 - native library failures land here
        raise SystemExit(
            f"[render-deps] {package} is installed but cannot be imported: {exc}. "
            "The image is missing native libraries (libpango, libharfbuzz, "
            "fontconfig); rebuild the backend image from "
            "docker/backend/Dockerfile."
        ) from exc
