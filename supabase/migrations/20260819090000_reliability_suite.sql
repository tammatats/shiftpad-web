alter table public.shiftpad_notification_deliveries
  add column if not exists subscription_id bigint references public.shiftpad_push_subscriptions(id) on delete cascade,
  add column if not exists status text not null default 'sent',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists failed_at timestamptz,
  add column if not exists last_error text not null default '',
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists workspace_key text not null default '',
  add column if not exists ward_name text not null default '',
  add column if not exists bed_label text not null default '',
  add column if not exists reminder_type text not null default '';

alter table public.shiftpad_notification_deliveries
  alter column sent_at drop not null,
  alter column sent_at drop default,
  alter column status set default 'scheduled';

alter table public.shiftpad_notification_deliveries
  drop constraint if exists shiftpad_notification_deliver_user_id_reminder_key_schedule_key;

drop index if exists public.shiftpad_notification_delivery_subscription_reminder_idx;
create unique index shiftpad_notification_delivery_subscription_reminder_idx
on public.shiftpad_notification_deliveries (subscription_id, reminder_key, scheduled_for);

create index if not exists shiftpad_notification_deliveries_user_updated_idx
on public.shiftpad_notification_deliveries (user_id, updated_at desc);

alter table public.shiftpad_notification_deliveries
  drop constraint if exists shiftpad_notification_deliveries_status_check;
alter table public.shiftpad_notification_deliveries
  add constraint shiftpad_notification_deliveries_status_check
  check (status in ('scheduled', 'sent', 'failed', 'cancelled'));

drop policy if exists "shiftpad_notification_deliveries_select_own" on public.shiftpad_notification_deliveries;
create policy "shiftpad_notification_deliveries_select_own"
on public.shiftpad_notification_deliveries
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.shiftpad_notification_deliveries to authenticated;

delete from public.shiftpad_editor_debug_logs
where logged_at < now() - interval '7 days';

update public.shiftpad_editor_debug_logs
set ward_name = '',
    note_title = '',
    payload = jsonb_build_object(
      'action', action,
      'handledBy', handled_by,
      'success', success,
      'browser', browser,
      'path', path,
      'legacyCompacted', true
    ),
    updated_at = timezone('utc', now())
where pg_column_size(payload) > 32768
   or ward_name <> ''
   or note_title <> '';

alter table public.shiftpad_editor_debug_logs
  drop constraint if exists shiftpad_editor_debug_logs_payload_size_check;
alter table public.shiftpad_editor_debug_logs
  add constraint shiftpad_editor_debug_logs_payload_size_check
  check (pg_column_size(payload) <= 32768);

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname in ('shiftpad_prune_editor_debug_logs_14_days', 'shiftpad_prune_editor_debug_logs_7_days')
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'shiftpad_prune_editor_debug_logs_7_days',
    '27 3 * * *',
    $cron$delete from public.shiftpad_editor_debug_logs where logged_at < now() - interval '7 days'$cron$
  );
end
$$;
