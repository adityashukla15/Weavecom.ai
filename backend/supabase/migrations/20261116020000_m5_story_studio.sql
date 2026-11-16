alter table public.stories
    add column description text not null default '',
    add column synopsis text not null default '',
    add column main_plot text not null default '',
    add column status text not null default 'draft'
        check (status in ('draft', 'published'));

drop policy stories_select_by_project_access on public.stories;
create policy stories_select_by_project_and_status
    on public.stories for select to authenticated
    using (
        (
            (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'writer'
            and public.can_access_project(project_id, true)
        )
        or (
            (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'reader'
            and status = 'published'
            and public.can_access_project(project_id)
        )
    );

drop policy chapters_select_by_project_access on public.chapters;
create policy chapters_select_by_project_and_story_status
    on public.chapters for select to authenticated
    using (
        exists (
            select 1
            from public.stories as story
            where story.id = chapters.story_id
              and (
                  public.can_access_project(story.project_id, true)
                  or (
                      story.status = 'published'
                      and public.can_access_project(story.project_id)
                  )
              )
        )
    );

create index stories_project_status_updated_idx
    on public.stories (project_id, status, updated_at desc);
