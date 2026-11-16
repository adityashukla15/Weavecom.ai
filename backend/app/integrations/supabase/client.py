from supabase import Client, create_client

from app.core.config import Settings


def create_supabase_client(settings: Settings) -> Client:
    if not settings.supabase_enabled:
        raise RuntimeError("Supabase integration is disabled.")
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise RuntimeError("Supabase credentials are not configured.")

    return create_client(
        settings.supabase_url,
        settings.supabase_secret_key.get_secret_value(),
    )
