from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.ai.errors import AIProviderError

T = TypeVar("T")


async def retry_provider_call(
    operation: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 0.25,
) -> T:
    for attempt in range(attempts):
        try:
            return await operation()
        except AIProviderError as error:
            if not error.retryable or attempt == attempts - 1:
                raise
            await asyncio.sleep(base_delay * (2**attempt))

    raise RuntimeError("Provider retry loop exited unexpectedly.")
