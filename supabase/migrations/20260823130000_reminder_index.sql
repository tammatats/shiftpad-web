create table if not exists public.shiftpad_reminder_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminders_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint shiftpad_reminder_state_array_check check (jsonb_typeof(reminders_json) = 'array'),
  constraint shiftpad_reminder_state_size_check check (pg_column_size(reminders_json) <= 262144)
);

alter table public.shiftpad_reminder_state enable row level security;

drop policy if exists "shiftpad_reminder_state_select_own" on public.shiftpad_reminder_state;
create policy "shiftpad_reminder_state_select_own"
on public.shiftpad_reminder_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_reminder_state_insert_own" on public.shiftpad_reminder_state;
create policy "shiftpad_reminder_state_insert_own"
on public.shiftpad_reminder_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_reminder_state_update_own" on public.shiftpad_reminder_state;
create policy "shiftpad_reminder_state_update_own"
on public.shiftpad_reminder_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_reminder_state_delete_own" on public.shiftpad_reminder_state;
create policy "shiftpad_reminder_state_delete_own"
on public.shiftpad_reminder_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.shiftpad_reminder_state from anon, authenticated;
grant select, insert, update, delete on table public.shiftpad_reminder_state to authenticated, service_role;
