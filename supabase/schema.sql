-- Projects showcase schema. Supabase Studio is the source of truth;
-- this file is a committed reference copy. Re-run is safe only on
-- a fresh project (the create table will fail if it already exists).

create table projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  summary         text not null,
  description     text,
  tech_stack      text[] not null default '{}',
  tags            text[] not null default '{}',
  demo_url        text,
  repo_url        text,
  screenshot_url  text,
  sort_order      int not null default 0,
  featured        boolean not null default false,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_published_idx on projects (published);
create index projects_sort_idx on projects (featured desc, sort_order asc);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

create policy "public reads published projects"
  on projects for select
  using (published = true);

create policy "owner reads all projects"
  on projects for select
  using (auth.email() = 'jkylecadap@gmail.com');

create policy "owner inserts projects"
  on projects for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates projects"
  on projects for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes projects"
  on projects for delete
  using (auth.email() = 'jkylecadap@gmail.com');

-- Storage RLS for the project-screenshots bucket. The bucket itself
-- is created via the Supabase Storage UI in Task 11; these policies
-- are applied at the same time.

create policy "public reads screenshots"
  on storage.objects for select
  using (bucket_id = 'project-screenshots');

create policy "owner inserts screenshots"
  on storage.objects for insert
  with check (bucket_id = 'project-screenshots'
              and auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates screenshots"
  on storage.objects for update
  using (bucket_id = 'project-screenshots'
         and auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes screenshots"
  on storage.objects for delete
  using (bucket_id = 'project-screenshots'
         and auth.email() = 'jkylecadap@gmail.com');
