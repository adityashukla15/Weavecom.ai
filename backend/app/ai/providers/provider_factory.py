from typing import Literal

from app.ai.providers.adaption import AdaptionProviderConfig
from app.ai.providers.gemini import GeminiProviderConfig
from app.core.config import Settings

ProviderName = Literal["adaption", "gemini"]
ProviderConfig = AdaptionProviderConfig | GeminiProviderConfig


def get_provider_config(name: ProviderName, settings: Settings) -> ProviderConfig:
    if name == "adaption":
        return AdaptionProviderConfig.from_settings(settings)
    if name == "gemini":
        return GeminiProviderConfig.from_settings(settings)
    raise ValueError(f"Unsupported AI provider: {name}")
