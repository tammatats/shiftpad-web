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

create table if not exists public.shiftpad_note_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text not null check (workspace_key in ('shift', 'day')),
  ward_id text not null,
  note_id text not null,
  document_html text not null default '<div><br></div>',
  note_updated_at bigint not null default 0,
  revision bigint not null default 1 check (revision > 0),
  client_id text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, workspace_key, note_id)
);

create index if not exists shiftpad_note_documents_user_updated_idx
on public.shiftpad_note_documents (user_id, updated_at desc);

alter table public.shiftpad_note_documents enable row level security;

drop policy if exists "shiftpad_note_documents_select_own" on public.shiftpad_note_documents;
create policy "shiftpad_note_documents_select_own"
on public.shiftpad_note_documents
for select
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.shiftpad_note_document_versions (
  user_id uuid not null,
  workspace_key text not null,
  ward_id text not null,
  note_id text not null,
  document_html text not null,
  note_updated_at bigint not null,
  revision bigint not null,
  client_id text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, workspace_key, note_id, revision),
  foreign key (user_id, workspace_key, note_id)
    references public.shiftpad_note_documents (user_id, workspace_key, note_id)
    on delete cascade
);

create index if not exists shiftpad_note_document_versions_user_note_idx
on public.shiftpad_note_document_versions (user_id, workspace_key, note_id, revision desc);

alter table public.shiftpad_note_document_versions enable row level security;

drop policy if exists "shiftpad_note_document_versions_select_own" on public.shiftpad_note_document_versions;
create policy "shiftpad_note_document_versions_select_own"
on public.shiftpad_note_document_versions
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.shiftpad_note_documents from anon, authenticated;
revoke all on table public.shiftpad_note_document_versions from anon, authenticated;
grant select on table public.shiftpad_note_documents to authenticated;
grant select on table public.shiftpad_note_document_versions to authenticated;
grant select, insert, update, delete on table public.shiftpad_note_documents to service_role;
grant select, insert, update, delete on table public.shiftpad_note_document_versions to service_role;

create or replace function public.shiftpad_commit_note_document(
  p_workspace_key text,
  p_ward_id text,
  p_note_id text,
  p_document_html text,
  p_note_updated_at bigint,
  p_expected_revision bigint,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.shiftpad_note_documents%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_workspace_key not in ('shift', 'day') then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  if coalesce(length(p_note_id), 0) = 0 or length(p_note_id) > 200 then
    raise exception 'Invalid note id' using errcode = '22023';
  end if;
  if coalesce(length(p_ward_id), 0) = 0 or length(p_ward_id) > 200 then
    raise exception 'Invalid ward id' using errcode = '22023';
  end if;
  if octet_length(coalesce(p_document_html, '')) > 2000000 then
    raise exception 'Note is too large to sync' using errcode = '22001';
  end if;

  if coalesce(p_expected_revision, 0) = 0 then
    insert into public.shiftpad_note_documents (
      user_id, workspace_key, ward_id, note_id, document_html,
      note_updated_at, revision, client_id
    ) values (
      v_user_id, p_workspace_key, p_ward_id, p_note_id,
      coalesce(nullif(p_document_html, ''), '<div><br></div>'),
      greatest(coalesce(p_note_updated_at, 0), 0), 1, left(coalesce(p_client_id, ''), 200)
    )
    on conflict (user_id, workspace_key, note_id) do nothing
    returning * into v_row;

    if found then
      insert into public.shiftpad_note_document_versions (
        user_id, workspace_key, ward_id, note_id, document_html,
        note_updated_at, revision, client_id, created_at
      ) values (
        v_row.user_id, v_row.workspace_key, v_row.ward_id, v_row.note_id, v_row.document_html,
        v_row.note_updated_at, v_row.revision, v_row.client_id, v_row.updated_at
      ) on conflict do nothing;
      return jsonb_build_object(
        'status', 'saved', 'workspace_key', v_row.workspace_key, 'ward_id', v_row.ward_id,
        'note_id', v_row.note_id, 'document_html', v_row.document_html,
        'note_updated_at', v_row.note_updated_at, 'revision', v_row.revision,
        'client_id', v_row.client_id, 'updated_at', v_row.updated_at
      );
    end if;
  end if;

  update public.shiftpad_note_documents as document
  set ward_id = p_ward_id,
      document_html = coalesce(nullif(p_document_html, ''), '<div><br></div>'),
      note_updated_at = greatest(coalesce(p_note_updated_at, 0), 0),
      revision = document.revision + 1,
      client_id = left(coalesce(p_client_id, ''), 200),
      updated_at = timezone('utc', now())
  where document.user_id = v_user_id
    and document.workspace_key = p_workspace_key
    and document.note_id = p_note_id
    and document.revision = coalesce(p_expected_revision, 0)
  returning document.* into v_row;

  if found then
    insert into public.shiftpad_note_document_versions (
      user_id, workspace_key, ward_id, note_id, document_html,
      note_updated_at, revision, client_id, created_at
    ) values (
      v_row.user_id, v_row.workspace_key, v_row.ward_id, v_row.note_id, v_row.document_html,
      v_row.note_updated_at, v_row.revision, v_row.client_id, v_row.updated_at
    ) on conflict do nothing;
    delete from public.shiftpad_note_document_versions as version
    where version.user_id = v_row.user_id
      and version.workspace_key = v_row.workspace_key
      and version.note_id = v_row.note_id
      and version.revision <= v_row.revision - 50;
    return jsonb_build_object(
      'status', 'saved', 'workspace_key', v_row.workspace_key, 'ward_id', v_row.ward_id,
      'note_id', v_row.note_id, 'document_html', v_row.document_html,
      'note_updated_at', v_row.note_updated_at, 'revision', v_row.revision,
      'client_id', v_row.client_id, 'updated_at', v_row.updated_at
    );
  end if;

  select document.* into v_row
  from public.shiftpad_note_documents as document
  where document.user_id = v_user_id
    and document.workspace_key = p_workspace_key
    and document.note_id = p_note_id;

  if found then
    return jsonb_build_object(
      'status', 'conflict', 'workspace_key', v_row.workspace_key, 'ward_id', v_row.ward_id,
      'note_id', v_row.note_id, 'document_html', v_row.document_html,
      'note_updated_at', v_row.note_updated_at, 'revision', v_row.revision,
      'client_id', v_row.client_id, 'updated_at', v_row.updated_at
    );
  end if;

  return jsonb_build_object(
    'status', 'missing', 'workspace_key', p_workspace_key, 'ward_id', p_ward_id,
    'note_id', p_note_id, 'revision', 0
  );
end;
$$;

revoke all on function public.shiftpad_commit_note_document(text, text, text, text, bigint, bigint, text) from public, anon;
grant execute on function public.shiftpad_commit_note_document(text, text, text, text, bigint, bigint, text) to authenticated, service_role;

insert into public.shiftpad_note_documents (
  user_id, workspace_key, ward_id, note_id, document_html,
  note_updated_at, revision, client_id
)
select
  user_state.user_id,
  workspace_entry.workspace_key,
  ward_entry.ward ->> 'id',
  note_entry.note ->> 'id',
  note_entry.note ->> 'documentHtml',
  case
    when coalesce(note_entry.note ->> 'updatedAt', '') ~ '^[0-9]+$'
      then (note_entry.note ->> 'updatedAt')::bigint
    else 0
  end,
  1,
  'state-backfill'
from public.shiftpad_user_state as user_state
cross join lateral jsonb_each(coalesce(user_state.state_json -> 'workspaces', '{}'::jsonb))
  as workspace_entry(workspace_key, workspace)
cross join lateral jsonb_array_elements(coalesce(workspace_entry.workspace -> 'wards', '[]'::jsonb))
  as ward_entry(ward)
cross join lateral jsonb_array_elements(coalesce(ward_entry.ward -> 'notes', '[]'::jsonb))
  as note_entry(note)
where workspace_entry.workspace_key in ('shift', 'day')
  and coalesce(ward_entry.ward ->> 'id', '') <> ''
  and coalesce(note_entry.note ->> 'id', '') <> ''
  and coalesce(note_entry.note ->> 'documentHtml', '') <> ''
on conflict (user_id, workspace_key, note_id) do nothing;

insert into public.shiftpad_note_document_versions (
  user_id, workspace_key, ward_id, note_id, document_html,
  note_updated_at, revision, client_id, created_at
)
select
  document.user_id, document.workspace_key, document.ward_id, document.note_id,
  document.document_html, document.note_updated_at, document.revision,
  document.client_id, document.updated_at
from public.shiftpad_note_documents as document
on conflict do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shiftpad_note_documents'
  ) then
    alter publication supabase_realtime add table public.shiftpad_note_documents;
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

create table if not exists public.shiftpad_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  source_workspace text not null check (source_workspace in ('shift', 'day')),
  title text not null,
  archived_for date not null,
  snapshot jsonb not null,
  stats jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create index if not exists shiftpad_archives_user_created_idx
on public.shiftpad_archives (user_id, created_at desc);

alter table public.shiftpad_archives enable row level security;

drop policy if exists "shiftpad_archives_select_own" on public.shiftpad_archives;
create policy "shiftpad_archives_select_own"
on public.shiftpad_archives
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_archives_insert_own" on public.shiftpad_archives;
create policy "shiftpad_archives_insert_own"
on public.shiftpad_archives
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_archives_update_own" on public.shiftpad_archives;
create policy "shiftpad_archives_update_own"
on public.shiftpad_archives
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "shiftpad_archives_delete_own" on public.shiftpad_archives;
create policy "shiftpad_archives_delete_own"
on public.shiftpad_archives
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.shiftpad_archives to authenticated, service_role;

insert into public.shiftpad_archives (
  user_id,
  id,
  source_workspace,
  title,
  archived_for,
  snapshot,
  stats,
  schema_version,
  created_at,
  updated_at
)
select
  user_state.user_id,
  coalesce(
    nullif(archive_entry ->> 'id', ''),
    'legacy-' || workspace.source_workspace || '-' ||
    case
      when coalesce(archive_entry ->> 'createdAt', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then floor((archive_entry ->> 'createdAt')::double precision)::bigint::text
      else '0'
    end || '-' ||
    coalesce(
      nullif(left(regexp_replace(lower(coalesce(archive_entry ->> 'label', 'archive')), '[^a-z0-9]+', '', 'g'), 24), ''),
      'archive'
    ) || '-' || jsonb_array_length(archive_entry -> 'wards')::text
  ),
  workspace.source_workspace,
  coalesce(nullif(archive_entry ->> 'label', ''), 'Archived ' || initcap(workspace.source_workspace) || 'Pad'),
  (to_timestamp(coalesce((archive_entry ->> 'createdAt')::double precision, extract(epoch from now()) * 1000) / 1000) at time zone 'Asia/Bangkok')::date,
  archive_entry,
  jsonb_build_object(
    'wardCount', jsonb_array_length(coalesce(archive_entry -> 'wards', '[]'::jsonb))
  ),
  1,
  to_timestamp(coalesce((archive_entry ->> 'createdAt')::double precision, extract(epoch from now()) * 1000) / 1000),
  timezone('utc', now())
from public.shiftpad_user_state as user_state
cross join lateral (
  values
    ('shift'::text, coalesce(user_state.state_json #> '{workspaces,shift,shiftArchives}', '[]'::jsonb)),
    ('day'::text, coalesce(user_state.state_json #> '{workspaces,day,shiftArchives}', '[]'::jsonb))
) as workspace(source_workspace, archives)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(workspace.archives) = 'array' then workspace.archives else '[]'::jsonb end
) as archive_entry
where jsonb_typeof(archive_entry -> 'wards') = 'array'
  and jsonb_array_length(archive_entry -> 'wards') > 0
on conflict (user_id, id) do nothing;
