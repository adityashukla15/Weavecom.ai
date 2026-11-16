create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    avatar_url text,
    bio text,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    description text not null default '',
    genre text not null default '',
    status text not null default 'draft' check (status in ('draft', 'published')),
    page_count integer not null default 0 check (page_count >= 0),
    page_target integer not null default 1 check (page_target > 0),
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

create table public.stories (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    genre text not null default '',
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now(),
    unique (project_id, sort_order)
);

create table public.chapters (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.stories (id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    body text not null default '',
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now(),
    unique (story_id, sort_order)
);

create table public.characters (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null check (pg_catalog.length(pg_catalog.btrim(name)) > 0),
    role_description text not null default '',
    traits text[] not null default '{}',
    abilities text[] not null default '{}',
    image_url text,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

create index projects_owner_updated_idx
    on public.projects (owner_id, updated_at desc);
create index projects_published_updated_idx
    on public.projects (updated_at desc)
    where status = 'published';
create index stories_project_order_idx
    on public.stories (project_id, sort_order);
create index chapters_story_order_idx
    on public.chapters (story_id, sort_order);
create index characters_project_idx
    on public.characters (project_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = pg_catalog.now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();
create trigger stories_set_updated_at
    before update on public.stories
    for each row execute function public.set_updated_at();
create trigger chapters_set_updated_at
    before update on public.chapters
    for each row execute function public.set_updated_at();
create trigger characters_set_updated_at
    before update on public.characters
    for each row execute function public.set_updated_at();

create or replace function public.can_access_project(
    target_project_id uuid,
    require_write boolean default false
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select exists (
        select 1
        from public.projects as project
        where project.id = target_project_id
          and (
              (
                  auth.jwt() -> 'app_metadata' ->> 'role' = 'writer'
                  and project.owner_id = auth.uid()
              )
              or (
                  not require_write
                  and auth.jwt() -> 'app_metadata' ->> 'role' = 'reader'
                  and project.status = 'published'
              )
          )
    );
$$;

revoke all on function public.can_access_project(uuid, boolean) from public;
revoke all on function public.can_access_project(uuid, boolean) from anon;
grant execute on function public.can_access_project(uuid, boolean) to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.stories to authenticated;
grant select, insert, update, delete on public.chapters to authenticated;
grant select, insert, update, delete on public.characters to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.stories enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;

create policy profiles_select_own
    on public.profiles for select to authenticated
    using (id = (select auth.uid()));
create policy profiles_insert_own
    on public.profiles for insert to authenticated
    with check (id = (select auth.uid()));
create policy profiles_update_own
    on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

create policy projects_select_by_role
    on public.projects for select to authenticated
    using (
        (
            (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
            and owner_id = (select auth.uid())
        )
        or (
            (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'reader'
            and status = 'published'
        )
    );
create policy projects_insert_writer_owner
    on public.projects for insert to authenticated
    with check (
        (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
        and owner_id = (select auth.uid())
    );
create policy projects_update_writer_owner
    on public.projects for update to authenticated
    using (
        (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
        and owner_id = (select auth.uid())
    )
    with check (
        (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
        and owner_id = (select auth.uid())
    );
create policy projects_delete_writer_owner
    on public.projects for delete to authenticated
    using (
        (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
        and owner_id = (select auth.uid())
    );

create policy stories_select_by_project_access
    on public.stories for select to authenticated
    using (public.can_access_project(project_id));
create policy stories_insert_by_project_owner
    on public.stories for insert to authenticated
    with check (public.can_access_project(project_id, true));
create policy stories_update_by_project_owner
    on public.stories for update to authenticated
    using (public.can_access_project(project_id, true))
    with check (public.can_access_project(project_id, true));
create policy stories_delete_by_project_owner
    on public.stories for delete to authenticated
    using (public.can_access_project(project_id, true));

create policy chapters_select_by_project_access
    on public.chapters for select to authenticated
    using (
        public.can_access_project(
            (select story.project_id from public.stories as story where story.id = chapters.story_id)
        )
    );
create policy chapters_insert_by_project_owner
    on public.chapters for insert to authenticated
    with check (
        public.can_access_project(
            (select story.project_id from public.stories as story where story.id = chapters.story_id),
            true
        )
    );
create policy chapters_update_by_project_owner
    on public.chapters for update to authenticated
    using (
        public.can_access_project(
            (select story.project_id from public.stories as story where story.id = chapters.story_id),
            true
        )
    )
    with check (
        public.can_access_project(
            (select story.project_id from public.stories as story where story.id = chapters.story_id),
            true
        )
    );
create policy chapters_delete_by_project_owner
    on public.chapters for delete to authenticated
    using (
        public.can_access_project(
            (select story.project_id from public.stories as story where story.id = chapters.story_id),
            true
        )
    );

create policy characters_select_by_project_access
    on public.characters for select to authenticated
    using (public.can_access_project(project_id));
create policy characters_insert_by_project_owner
    on public.characters for insert to authenticated
    with check (public.can_access_project(project_id, true));
create policy characters_update_by_project_owner
    on public.characters for update to authenticated
    using (public.can_access_project(project_id, true))
    with check (public.can_access_project(project_id, true));
create policy characters_delete_by_project_owner
    on public.characters for delete to authenticated
    using (public.can_access_project(project_id, true));
