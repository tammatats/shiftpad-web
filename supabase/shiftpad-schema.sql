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
