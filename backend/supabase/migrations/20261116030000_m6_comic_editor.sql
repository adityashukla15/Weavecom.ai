create table public.comics (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.stories (id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    description text not null default '',
    status text not null default 'draft' check (status in ('draft', 'completed')),
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

create table public.comic_panels (
    id uuid primary key default gen_random_uuid(),
    comic_id uuid not null references public.comics (id) on delete cascade,
    panel_number integer not null check (panel_number > 0),
    description text not null default '',
    image_url text,
    layout jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now(),
    unique (comic_id, panel_number)
);

create table public.comic_speech_bubbles (
    id uuid primary key default gen_random_uuid(),
    panel_id uuid not null references public.comic_panels (id) on delete cascade,
    text text not null check (pg_catalog.length(pg_catalog.btrim(text)) > 0),
    bubble_type text not null default 'speech'
        check (bubble_type in ('speech', 'thought', 'narration')),
    position_x double precision not null default 50 check (position_x between 0 and 100),
    position_y double precision not null default 20 check (position_y between 0 and 100),
    created_at timestamptz not null default pg_catalog.now(),
    updated_at timestamptz not null default pg_catalog.now()
);

create index comics_story_updated_idx on public.comics (story_id, updated_at desc);
create index comic_panels_comic_order_idx on public.comic_panels (comic_id, panel_number);
create index comic_speech_bubbles_panel_idx on public.comic_speech_bubbles (panel_id);

create trigger comics_set_updated_at
    before update on public.comics
    for each row execute function public.set_updated_at();
create trigger comic_panels_set_updated_at
    before update on public.comic_panels
    for each row execute function public.set_updated_at();
create trigger comic_speech_bubbles_set_updated_at
    before update on public.comic_speech_bubbles
    for each row execute function public.set_updated_at();

alter table public.comics enable row level security;
alter table public.comic_panels enable row level security;
alter table public.comic_speech_bubbles enable row level security;

grant select, insert, update, delete on public.comics to authenticated;
grant select, insert, update, delete on public.comic_panels to authenticated;
grant select, insert, update, delete on public.comic_speech_bubbles to authenticated;

create policy comics_select_by_story_access
    on public.comics for select to authenticated
    using (
        exists (
            select 1
            from public.stories as story
            where story.id = comics.story_id
              and (
                  public.can_access_project(story.project_id, true)
                  or (
                      comics.status = 'completed'
                      and story.status = 'published'
                      and public.can_access_project(story.project_id)
                  )
              )
        )
    );
create policy comics_insert_by_story_owner
    on public.comics for insert to authenticated
    with check (
        exists (
            select 1 from public.stories as story
            where story.id = comics.story_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comics_update_by_story_owner
    on public.comics for update to authenticated
    using (
        exists (
            select 1 from public.stories as story
            where story.id = comics.story_id
              and public.can_access_project(story.project_id, true)
        )
    )
    with check (
        exists (
            select 1 from public.stories as story
            where story.id = comics.story_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comics_delete_by_story_owner
    on public.comics for delete to authenticated
    using (
        exists (
            select 1 from public.stories as story
            where story.id = comics.story_id
              and public.can_access_project(story.project_id, true)
        )
    );

create policy comic_panels_select_by_comic_access
    on public.comic_panels for select to authenticated
    using (
        exists (
            select 1
            from public.comics as comic
            join public.stories as story on story.id = comic.story_id
            where comic.id = comic_panels.comic_id
              and (
                  public.can_access_project(story.project_id, true)
                  or (
                      comic.status = 'completed'
                      and story.status = 'published'
                      and public.can_access_project(story.project_id)
                  )
              )
        )
    );
create policy comic_panels_insert_by_comic_owner
    on public.comic_panels for insert to authenticated
    with check (
        exists (
            select 1
            from public.comics as comic
            join public.stories as story on story.id = comic.story_id
            where comic.id = comic_panels.comic_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comic_panels_update_by_comic_owner
    on public.comic_panels for update to authenticated
    using (
        exists (
            select 1
            from public.comics as comic
            join public.stories as story on story.id = comic.story_id
            where comic.id = comic_panels.comic_id
              and public.can_access_project(story.project_id, true)
        )
    )
    with check (
        exists (
            select 1
            from public.comics as comic
            join public.stories as story on story.id = comic.story_id
            where comic.id = comic_panels.comic_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comic_panels_delete_by_comic_owner
    on public.comic_panels for delete to authenticated
    using (
        exists (
            select 1
            from public.comics as comic
            join public.stories as story on story.id = comic.story_id
            where comic.id = comic_panels.comic_id
              and public.can_access_project(story.project_id, true)
        )
    );

create policy comic_bubbles_select_by_panel_access
    on public.comic_speech_bubbles for select to authenticated
    using (
        exists (
            select 1
            from public.comic_panels as panel
            join public.comics as comic on comic.id = panel.comic_id
            join public.stories as story on story.id = comic.story_id
            where panel.id = comic_speech_bubbles.panel_id
              and (
                  public.can_access_project(story.project_id, true)
                  or (
                      comic.status = 'completed'
                      and story.status = 'published'
                      and public.can_access_project(story.project_id)
                  )
              )
        )
    );
create policy comic_bubbles_insert_by_panel_owner
    on public.comic_speech_bubbles for insert to authenticated
    with check (
        exists (
            select 1
            from public.comic_panels as panel
            join public.comics as comic on comic.id = panel.comic_id
            join public.stories as story on story.id = comic.story_id
            where panel.id = comic_speech_bubbles.panel_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comic_bubbles_update_by_panel_owner
    on public.comic_speech_bubbles for update to authenticated
    using (
        exists (
            select 1
            from public.comic_panels as panel
            join public.comics as comic on comic.id = panel.comic_id
            join public.stories as story on story.id = comic.story_id
            where panel.id = comic_speech_bubbles.panel_id
              and public.can_access_project(story.project_id, true)
        )
    )
    with check (
        exists (
            select 1
            from public.comic_panels as panel
            join public.comics as comic on comic.id = panel.comic_id
            join public.stories as story on story.id = comic.story_id
            where panel.id = comic_speech_bubbles.panel_id
              and public.can_access_project(story.project_id, true)
        )
    );
create policy comic_bubbles_delete_by_panel_owner
    on public.comic_speech_bubbles for delete to authenticated
    using (
        exists (
            select 1
            from public.comic_panels as panel
            join public.comics as comic on comic.id = panel.comic_id
            join public.stories as story on story.id = comic.story_id
            where panel.id = comic_speech_bubbles.panel_id
              and public.can_access_project(story.project_id, true)
        )
    );
