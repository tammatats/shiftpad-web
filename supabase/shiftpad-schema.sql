create table if not exists public.shiftpad_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.shiftpad_user_state enable row level security;

drop policy if exists "shiftpad_user_state_select_own" on public.shiftpad_user_state;
create policy "shiftpad_user_state_select_own"
on public.shiftpad_user_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "shiftpad_user_state_insert_own" on public.shiftpad_user_state;
create policy "shiftpad_user_state_insert_own"
on public.shiftpad_user_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "shiftpad_user_state_update_own" on public.shiftpad_user_state;
create policy "shiftpad_user_state_update_own"
on public.shiftpad_user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "shiftpad_user_state_delete_own" on public.shiftpad_user_state;
create policy "shiftpad_user_state_delete_own"
on public.shiftpad_user_state
for delete
to authenticated
using (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shiftpad_user_state'
  ) then
    alter publication supabase_realtime add table public.shiftpad_user_state;
  end if;
end $$;

create table if not exists public.shiftpad_push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  time_zone text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

alter table public.shiftpad_push_subscriptions enable row level security;

drop policy if exists "shiftpad_push_subscriptions_select_own" on public.shiftpad_push_subscriptions;
create policy "shiftpad_push_subscriptions_select_own"
on public.shiftpad_push_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "shiftpad_push_subscriptions_insert_own" on public.shiftpad_push_subscriptions;
create policy "shiftpad_push_subscriptions_insert_own"
on public.shiftpad_push_subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "shiftpad_push_subscriptions_update_own" on public.shiftpad_push_subscriptions;
create policy "shiftpad_push_subscriptions_update_own"
on public.shiftpad_push_subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "shiftpad_push_subscriptions_delete_own" on public.shiftpad_push_subscriptions;
create policy "shiftpad_push_subscriptions_delete_own"
on public.shiftpad_push_subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.shiftpad_notification_deliveries (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  scheduled_for timestamptz not null,
  title text not null,
  body text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (user_id, reminder_key, scheduled_for)
);

alter table public.shiftpad_notification_deliveries enable row level security;

grant select, insert, update, delete on table public.shiftpad_user_state to authenticated, service_role;
grant select, insert, update, delete on table public.shiftpad_push_subscriptions to authenticated, service_role;
grant usage, select on sequence public.shiftpad_push_subscriptions_id_seq to authenticated, service_role;
grant select, insert, update, delete on table public.shiftpad_notification_deliveries to service_role;
grant usage, select on sequence public.shiftpad_notification_deliveries_id_seq to service_role;

create table if not exists public.shiftpad_editor_debug_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_log_id text not null,
  logged_at timestamptz not null,
  browser text not null default '',
  path text not null default '',
  ward_id text not null default '',
  ward_name text not null default '',
  note_id text not null default '',
  note_title text not null default '',
  action text not null default '',
  handled_by text not null default '',
  success boolean,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_log_id)
);

create index if not exists shiftpad_editor_debug_logs_user_created_idx
on public.shiftpad_editor_debug_logs (user_id, created_at desc);

create index if not exists shiftpad_editor_debug_logs_logged_at_idx
on public.shiftpad_editor_debug_logs (logged_at);

alter table public.shiftpad_editor_debug_logs enable row level security;

drop policy if exists "shiftpad_editor_debug_logs_select_own" on public.shiftpad_editor_debug_logs;
create policy "shiftpad_editor_debug_logs_select_own"
on public.shiftpad_editor_debug_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_editor_debug_logs_insert_own" on public.shiftpad_editor_debug_logs;
create policy "shiftpad_editor_debug_logs_insert_own"
on public.shiftpad_editor_debug_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_editor_debug_logs_update_own" on public.shiftpad_editor_debug_logs;
create policy "shiftpad_editor_debug_logs_update_own"
on public.shiftpad_editor_debug_logs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_editor_debug_logs_delete_own" on public.shiftpad_editor_debug_logs;
create policy "shiftpad_editor_debug_logs_delete_own"
on public.shiftpad_editor_debug_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'shiftpad_prune_editor_debug_logs_14_days'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'shiftpad_prune_editor_debug_logs_14_days',
    '27 3 * * *',
    $cron$delete from public.shiftpad_editor_debug_logs where logged_at < now() - interval '14 days'$cron$
  );
end
$$;

grant select, insert, update, delete on table public.shiftpad_editor_debug_logs to authenticated, service_role;
grant usage, select on sequence public.shiftpad_editor_debug_logs_id_seq to authenticated, service_role;
