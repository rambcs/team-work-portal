-- =====================================================================
-- Team Work Portal — upgrade v2
-- Adds: login/logout attendance, OneDrive links on tasks, richer task
-- updates (status + link + remarks), in-app notifications, push alert
-- subscriptions, and settings for push alerts and summary emails.
--
-- Run once in Supabase → SQL Editor, AFTER schema.sql. Safe to re-run.
-- =====================================================================

create extension if not exists pg_net;

-- ---------- Profiles: WhatsApp number + email for summaries ----------
alter table public.profiles add column if not exists whatsapp      text not null default '';
alter table public.profiles add column if not exists summary_email text not null default '';

-- ---------- Task updates: status change + file link + optional remarks
alter table public.task_updates add column if not exists status_to  text;
alter table public.task_updates add column if not exists link_url   text;
alter table public.task_updates add column if not exists link_label text not null default '';
alter table public.task_updates alter column body set default '';
alter table public.task_updates drop constraint if exists task_updates_body_check;
alter table public.task_updates drop constraint if exists task_updates_content_check;
alter table public.task_updates drop constraint if exists task_updates_status_to_check;
alter table public.task_updates drop constraint if exists task_updates_link_check;
alter table public.task_updates add constraint task_updates_content_check
  check (length(body) <= 4000 and (length(body) > 0 or status_to is not null or link_url is not null));
alter table public.task_updates add constraint task_updates_status_to_check
  check (status_to is null or status_to in ('To do','In progress','Blocked','Done'));
alter table public.task_updates add constraint task_updates_link_check
  check (link_url is null or link_url ~* '^https://');

-- ---------- Time entries: remarks become optional --------------------
alter table public.time_entries alter column description set default '';
alter table public.time_entries drop constraint if exists time_entries_description_check;
alter table public.time_entries drop constraint if exists time_entries_description_len;
alter table public.time_entries add constraint time_entries_description_len check (length(description) <= 4000);

-- ---------- Reference files (OneDrive links) on a task ---------------
create table if not exists public.task_links (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  url         text not null check (url ~* '^https://' and length(url) <= 2000),
  label       text not null default '' check (length(label) <= 200),
  added_by    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists task_links_task_idx on public.task_links(task_id);

-- ---------- Attendance: login / logout per person per day ------------
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  work_date   date not null,
  login_at    time,
  logout_at   time,
  break_mins  integer not null default 0 check (break_mins between 0 and 600),
  note        text not null default '' check (length(note) <= 1000),
  updated_at  timestamptz not null default now(),
  unique (user_id, work_date),
  check (logout_at is null or login_at is null or logout_at > login_at)
);

create or replace function public.touch_attendance()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Attendance cannot be moved to another person';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch before insert or update on public.attendance
  for each row execute function public.touch_attendance();

-- ---------- In-app notifications --------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('assigned','update','status')),
  task_id     uuid references public.tasks(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------- Push alert subscriptions (one per device/browser) --------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Private settings (function URL, shared secret) -----------
create table if not exists public.app_settings (
  key    text primary key,
  value  text not null
);

-- ---------- Row Level Security ----------------------------------------
alter table public.task_links          enable row level security;
alter table public.attendance          enable row level security;
alter table public.notifications       enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.app_settings        enable row level security;   -- no policies: invisible to the app

-- task links: anyone who can see the task can read and add; you remove your own (manager: any)
drop policy if exists "links read"   on public.task_links;
drop policy if exists "links insert" on public.task_links;
drop policy if exists "links delete" on public.task_links;
create policy "links read" on public.task_links for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and ((t.assignee = auth.uid() and public.is_active()) or public.is_manager())));
create policy "links insert" on public.task_links for insert to authenticated with check (
  added_by = auth.uid() and
  exists (select 1 from public.tasks t where t.id = task_id and ((t.assignee = auth.uid() and public.is_active()) or public.is_manager())));
create policy "links delete" on public.task_links for delete to authenticated using (added_by = auth.uid() or public.is_manager());

-- attendance: same model as time entries
drop policy if exists "att read"   on public.attendance;
drop policy if exists "att insert" on public.attendance;
drop policy if exists "att update" on public.attendance;
drop policy if exists "att delete" on public.attendance;
create policy "att read"   on public.attendance for select to authenticated using ((user_id = auth.uid() and public.is_active()) or public.is_manager());
create policy "att insert" on public.attendance for insert to authenticated with check (user_id = auth.uid() and public.is_active());
create policy "att update" on public.attendance for update to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid());
create policy "att delete" on public.attendance for delete to authenticated using (user_id = auth.uid() and public.is_active());

-- notifications: only your own; created by the database itself
drop policy if exists "notif read"   on public.notifications;
drop policy if exists "notif update" on public.notifications;
drop policy if exists "notif delete" on public.notifications;
create policy "notif read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- push subscriptions: only your own (register via the function below)
drop policy if exists "push read"   on public.push_subscriptions;
drop policy if exists "push delete" on public.push_subscriptions;
create policy "push read"   on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active() then raise exception 'Not signed in'; end if;
  if p_endpoint !~* '^https://' then raise exception 'Invalid endpoint'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;   -- shared device: last person wins
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;
revoke all on function public.register_push(text,text,text) from public, anon;
grant execute on function public.register_push(text,text,text) to authenticated;

-- ---------- Notification triggers ------------------------------------

-- send a push alert for each new notification (if push is configured)
create or replace function public.push_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url    from public.app_settings where key = 'functions_url';
  select value into v_secret from public.app_settings where key = 'hook_secret';
  if v_url is null or v_secret is null then return new; end if;
  begin
    perform net.http_post(
      url     := v_url || '/send-push',
      body    := jsonb_build_object('notification_id', new.id),
      headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', v_secret),
      timeout_milliseconds := 10000);
  exception when others then null;  -- never block the app because of an alert
  end;
  return new;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_notification();

-- new task, or task moved to someone else → notify the assignee
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_by text;
begin
  if tg_op = 'UPDATE' and new.assignee is not distinct from old.assignee then return new; end if;
  if new.assignee is not distinct from new.assigned_by and tg_op = 'INSERT' then return new; end if;
  select full_name into v_by from public.profiles where id = new.assigned_by;
  insert into public.notifications (user_id, kind, task_id, title, body)
  values (new.assignee, 'assigned', new.id,
          'New ' || lower(new.type) || ' from ' || coalesce(nullif(v_by,''), 'your manager'),
          new.title || case when new.due_date is not null then ', due ' || to_char(new.due_date, 'DD Mon') else '' end);
  return new;
end $$;
drop trigger if exists tasks_notify on public.tasks;
create trigger tasks_notify after insert or update of assignee on public.tasks
  for each row execute function public.notify_task_assigned();

-- task update → notify the other side (member ↔ the manager who assigned it)
create or replace function public.notify_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.tasks; v_author text; v_target uuid; v_title text; v_body text;
begin
  select * into t from public.tasks where id = new.task_id;
  if not found then return new; end if;
  select full_name into v_author from public.profiles where id = new.author;
  v_target := case when new.author = t.assignee then t.assigned_by else t.assignee end;
  if v_target is null or v_target = new.author then return new; end if;
  v_title := coalesce(nullif(v_author,''), 'Someone') ||
             case when new.status_to is not null then ' marked it ' || new.status_to
                  when new.link_url  is not null then ' attached a file'
                  else ' posted an update' end;
  v_body := t.title || case when new.body <> '' then ': ' || left(new.body, 140) else '' end;
  insert into public.notifications (user_id, kind, task_id, title, body)
  values (v_target, case when new.status_to is not null then 'status' else 'update' end, t.id, v_title, v_body);
  return new;
end $$;
drop trigger if exists task_updates_notify on public.task_updates;
create trigger task_updates_notify after insert on public.task_updates
  for each row execute function public.notify_task_update();

-- ---------- Live updates ---------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['task_links','attendance','notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;
    end;
  end loop;
end $$;
