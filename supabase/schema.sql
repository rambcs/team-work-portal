-- =====================================================================
-- Team Work Portal — Supabase schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'member' check (role in ('manager','member')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.engagements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete restrict,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(title) between 1 and 200),
  details        text not null default '',
  type           text not null default 'Task' check (type in ('Task','Area / Role','Instruction')),
  engagement_id  uuid references public.engagements(id) on delete restrict,
  assignee       uuid not null references public.profiles(id) on delete cascade,
  assigned_by    uuid references public.profiles(id) on delete set null,
  due_date       date,
  priority       text not null default 'Medium' check (priority in ('High','Medium','Low')),
  status         text not null default 'To do' check (status in ('To do','In progress','Blocked','Done')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks(assignee);

create table if not exists public.task_updates (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author      uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists task_updates_task_idx on public.task_updates(task_id);

create table if not exists public.time_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  entry_date     date not null,
  engagement_id  uuid references public.engagements(id) on delete restrict,
  task_id        uuid references public.tasks(id) on delete set null,
  hours          numeric(5,2) not null check (hours > 0 and hours <= 24),
  description    text not null check (length(description) between 1 and 4000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists time_entries_user_date_idx on public.time_entries(user_id, entry_date);

-- ---------- Helper: is the current user an active manager? -----------

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager' and active);
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

-- ---------- New sign-ups get a profile automatically -----------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Guards: members can't escalate or rewrite assignments ----

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then  -- SQL editor / service role skip this check
    if new.role is distinct from old.role or new.active is distinct from old.active
       or new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'Only a manager can change role, status or email';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_manager() then  -- SQL editor / service role skip this check
    if new.title is distinct from old.title or new.details is distinct from old.details
       or new.type is distinct from old.type or new.engagement_id is distinct from old.engagement_id
       or new.assignee is distinct from old.assignee or new.assigned_by is distinct from old.assigned_by
       or new.due_date is distinct from old.due_date or new.priority is distinct from old.priority
       or new.created_at is distinct from old.created_at then
      raise exception 'Only a manager can change assignment details — you can update the status';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tasks_guard on public.tasks;
create trigger tasks_guard before update on public.tasks
  for each row execute function public.guard_task_update();

create or replace function public.touch_time_entry()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Entries cannot be moved to another person';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists time_entries_touch on public.time_entries;
create trigger time_entries_touch before update on public.time_entries
  for each row execute function public.touch_time_entry();

-- ---------- Row Level Security ---------------------------------------

alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.engagements   enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_updates  enable row level security;
alter table public.time_entries  enable row level security;

-- profiles: everyone on the team sees names; you edit your own name; manager edits all
drop policy if exists "profiles read"         on public.profiles;
drop policy if exists "profiles self update"  on public.profiles;
drop policy if exists "profiles mgr update"   on public.profiles;
create policy "profiles read"        on public.profiles for select to authenticated using (public.is_active());
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles mgr update"  on public.profiles for update to authenticated using (public.is_manager()) with check (public.is_manager());

-- clients & engagements: all active users read; only managers write
drop policy if exists "clients read"  on public.clients;
drop policy if exists "clients write" on public.clients;
create policy "clients read"  on public.clients for select to authenticated using (public.is_active());
create policy "clients write" on public.clients for all    to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists "engagements read"  on public.engagements;
drop policy if exists "engagements write" on public.engagements;
create policy "engagements read"  on public.engagements for select to authenticated using (public.is_active());
create policy "engagements write" on public.engagements for all    to authenticated using (public.is_manager()) with check (public.is_manager());

-- tasks: members see and update (status only, via guard) their own; managers do everything
drop policy if exists "tasks read"   on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks read"   on public.tasks for select to authenticated using ((assignee = auth.uid() and public.is_active()) or public.is_manager());
create policy "tasks insert" on public.tasks for insert to authenticated with check (public.is_manager());
create policy "tasks update" on public.tasks for update to authenticated using ((assignee = auth.uid() and public.is_active()) or public.is_manager())
                                                                     with check ((assignee = auth.uid() and public.is_active()) or public.is_manager());
create policy "tasks delete" on public.tasks for delete to authenticated using (public.is_manager());

-- task updates: anyone who can see the task can read and post (as themselves)
drop policy if exists "updates read"   on public.task_updates;
drop policy if exists "updates insert" on public.task_updates;
drop policy if exists "updates delete" on public.task_updates;
create policy "updates read" on public.task_updates for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and ((t.assignee = auth.uid() and public.is_active()) or public.is_manager())));
create policy "updates insert" on public.task_updates for insert to authenticated with check (
  author = auth.uid() and
  exists (select 1 from public.tasks t where t.id = task_id and ((t.assignee = auth.uid() and public.is_active()) or public.is_manager())));
create policy "updates delete" on public.task_updates for delete to authenticated using (author = auth.uid() or public.is_manager());

-- time entries: you see/edit only your own; managers see everyone's (read-only)
drop policy if exists "time read"   on public.time_entries;
drop policy if exists "time insert" on public.time_entries;
drop policy if exists "time update" on public.time_entries;
drop policy if exists "time delete" on public.time_entries;
create policy "time read"   on public.time_entries for select to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_manager());
create policy "time insert" on public.time_entries for insert to authenticated with check (user_id = auth.uid() and public.is_active());
create policy "time update" on public.time_entries for update to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid());
create policy "time delete" on public.time_entries for delete to authenticated using (user_id = auth.uid() and public.is_active());

-- ---------- Live updates (other people's changes appear without refresh)

do $$
declare t text;
begin
  foreach t in array array['profiles','clients','engagements','tasks','task_updates','time_entries'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;  -- already added, or realtime not set up
    end;
  end loop;
end $$;

-- =====================================================================
-- AFTER you have signed in to the portal once, make yourself manager:
--
--   update public.profiles set role = 'manager' where email = 'you@yourfirm.com';
--
-- =====================================================================
