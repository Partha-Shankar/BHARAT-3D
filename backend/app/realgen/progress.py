# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Live notes from long network steps, shown under the current stage while an area is generated.

The generation endpoint installs a reporter for its job (``asyncio.to_thread`` copies context variables into the
worker thread), and the fetchers call :func:`note`. Without a reporter, :func:`note` does nothing, so the engine and
the tests behave exactly as before.
"""
from __future__ import annotations

import logging
from collections.abc import Callable
from contextvars import ContextVar, Token

logger = logging.getLogger(__name__)

Reporter = Callable[[str, "float | None"], None]
_current: ContextVar[Reporter | None] = ContextVar("realgen_progress", default=None)


def current() -> Reporter | None:
    """The reporter of the job running in this context, if any."""
    return _current.get()


def use(reporter: Reporter | None) -> Token:
    """Install a reporter for this context; pass the returned token to :func:`reset`."""
    return _current.set(reporter)


def reset(token: Token) -> None:
    _current.reset(token)


def note(message: str, fraction: float | None = None) -> None:
    """Report what is happening now; ``fraction`` (0..1) is how far the current step has got, when known.

    Never raises: a progress note must not be able to fail a generation.
    """
    reporter = _current.get()
    if reporter is None:
        return
    try:
        reporter(message, None if fraction is None else max(0.0, min(1.0, float(fraction))))
    except Exception:
        logger.debug("progress reporter failed", exc_info=True)
