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
