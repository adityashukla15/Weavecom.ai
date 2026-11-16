from dataclasses import dataclass

from pydantic import SecretStr

from app.core.config import Settings


@dataclass(frozen=True)
class GeminiProviderConfig:
    api_key: SecretStr | None
    image_model: str

    @classmethod
    def from_settings(cls, settings: Settings) -> GeminiProviderConfig:
        return cls(
            api_key=settings.gemini_api_key,
            image_model=settings.gemini_image_model,
        )
