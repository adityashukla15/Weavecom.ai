from supabase import Client, create_client

from app.core.config import Settings


def create_supabase_client(settings: Settings) -> Client:
    """Create the server-key client for Supabase Auth token verification only."""
    if not settings.supabase_enabled:
        raise RuntimeError("Supabase integration is disabled.")
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise RuntimeError("Supabase credentials are not configured.")

    return create_client(
        settings.supabase_url,
        settings.supabase_secret_key.get_secret_value(),
    )


def create_user_scoped_supabase_client(settings: Settings, access_token: str) -> Client:
    """Create a PostgREST client whose requests use the caller's RLS claims."""
    if not settings.supabase_enabled:
        raise RuntimeError("Supabase integration is disabled.")
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise RuntimeError("Supabase publishable credentials are not configured.")

    client = create_client(
        settings.supabase_url,
        settings.supabase_publishable_key.get_secret_value(),
    )
    client.postgrest.auth(access_token)
    return client
