from dataclasses import dataclass

from pydantic import SecretStr

from app.core.config import Settings


@dataclass(frozen=True)
class AdaptionProviderConfig:
    api_key: SecretStr | None
    base_url: str
    model: str

    @classmethod
    def from_settings(cls, settings: Settings) -> AdaptionProviderConfig:
        return cls(
            api_key=settings.adaption_api_key,
            base_url=settings.adaption_base_url,
            model=settings.adaption_model,
        )
