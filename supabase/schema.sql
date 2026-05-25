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
--
-- Note: no public SELECT policy. Public bucket access happens via the
-- /storage/v1/object/public/<bucket>/<file> URL, which does not require
-- an RLS policy. A broad SELECT would just let clients enumerate every
-- filename, which we don't need.

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

-- Skills table (added 2026-05-14). Owner-managed via /admin; rendered on
-- the public Skills section unioned with project tech_stack/tags strings.

create table skills (
  id           uuid primary key default gen_random_uuid(),
  name         text unique not null,
  category     text not null check (category in (
    'frameworks', 'languages', 'apis', 'testing', 'databases', 'tools'
  )),
  icon_url     text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index skills_category_idx on skills (category);
create index skills_sort_idx on skills (sort_order asc, name asc);

create trigger skills_set_updated_at
  before update on skills
  for each row execute function set_updated_at();

alter table skills enable row level security;

create policy "public reads all skills"
  on skills for select
  using (true);

create policy "owner inserts skills"
  on skills for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates skills"
  on skills for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes skills"
  on skills for delete
  using (auth.email() = 'jkylecadap@gmail.com');

-- Project screenshots gallery (added 2026-05-25). One row per additional
-- screenshot on a project's detail page; the cover stays in
-- projects.screenshot_url.

create table project_screenshots (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  url          text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index project_screenshots_project_idx
  on project_screenshots (project_id, sort_order asc);

alter table project_screenshots enable row level security;

create policy "public reads screenshots of published projects"
  on project_screenshots for select
  using (exists (
    select 1 from projects p
    where p.id = project_screenshots.project_id
      and p.published = true
  ));

create policy "owner reads all screenshots"
  on project_screenshots for select
  using (auth.email() = 'jkylecadap@gmail.com');

create policy "owner inserts screenshots rows"
  on project_screenshots for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates screenshots rows"
  on project_screenshots for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes screenshots rows"
  on project_screenshots for delete
  using (auth.email() = 'jkylecadap@gmail.com');
