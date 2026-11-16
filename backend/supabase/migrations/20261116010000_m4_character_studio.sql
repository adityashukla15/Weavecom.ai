alter table public.characters
    add column description text not null default '',
    add column personality text not null default '',
    add column appearance text not null default '',
    add column background text not null default '',
    add column character_role text not null default 'supporting'
        check (character_role in ('protagonist', 'antagonist', 'supporting'));
