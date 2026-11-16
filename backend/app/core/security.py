from __future__ import annotations

from pydantic import SecretStr


def validate_secret_key(value: SecretStr | str) -> SecretStr:
    secret = value.get_secret_value() if isinstance(value, SecretStr) else value
    if len(secret) < 32:
        raise ValueError("SECRET_KEY must contain at least 32 characters.")
    if "replace-with" in secret.lower() or "change-me" in secret.lower():
        raise ValueError("SECRET_KEY must not use a placeholder value.")
    return SecretStr(secret)
