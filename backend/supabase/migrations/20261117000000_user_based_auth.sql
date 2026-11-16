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
              project.owner_id = auth.uid()
              or (
                  not require_write
                  and project.status = 'published'
              )
          )
    );
$$;

drop policy projects_select_by_role on public.projects;
create policy projects_select_owned_or_published
    on public.projects for select to authenticated
    using (
        owner_id = (select auth.uid())
        or status = 'published'
    );

drop policy projects_insert_writer_owner on public.projects;
create policy projects_insert_owner
    on public.projects for insert to authenticated
    with check (owner_id = (select auth.uid()));

drop policy projects_update_writer_owner on public.projects;
create policy projects_update_owner
    on public.projects for update to authenticated
    using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

drop policy projects_delete_writer_owner on public.projects;
create policy projects_delete_owner
    on public.projects for delete to authenticated
    using (owner_id = (select auth.uid()));

drop policy stories_select_by_project_and_status on public.stories;
create policy stories_select_by_project_and_status
    on public.stories for select to authenticated
    using (
        public.can_access_project(project_id, true)
        or (
            status = 'published'
            and public.can_access_project(project_id)
        )
    );
