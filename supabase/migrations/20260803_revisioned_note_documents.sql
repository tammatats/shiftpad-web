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
      user_id,
      workspace_key,
      ward_id,
      note_id,
      document_html,
      note_updated_at,
      revision,
      client_id
    )
    values (
      v_user_id,
      p_workspace_key,
      p_ward_id,
      p_note_id,
      coalesce(nullif(p_document_html, ''), '<div><br></div>'),
      greatest(coalesce(p_note_updated_at, 0), 0),
      1,
      left(coalesce(p_client_id, ''), 200)
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
        'status', 'saved',
        'workspace_key', v_row.workspace_key,
        'ward_id', v_row.ward_id,
        'note_id', v_row.note_id,
        'document_html', v_row.document_html,
        'note_updated_at', v_row.note_updated_at,
        'revision', v_row.revision,
        'client_id', v_row.client_id,
        'updated_at', v_row.updated_at
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
      'status', 'saved',
      'workspace_key', v_row.workspace_key,
      'ward_id', v_row.ward_id,
      'note_id', v_row.note_id,
      'document_html', v_row.document_html,
      'note_updated_at', v_row.note_updated_at,
      'revision', v_row.revision,
      'client_id', v_row.client_id,
      'updated_at', v_row.updated_at
    );
  end if;

  select document.*
  into v_row
  from public.shiftpad_note_documents as document
  where document.user_id = v_user_id
    and document.workspace_key = p_workspace_key
    and document.note_id = p_note_id;

  if found then
    return jsonb_build_object(
      'status', 'conflict',
      'workspace_key', v_row.workspace_key,
      'ward_id', v_row.ward_id,
      'note_id', v_row.note_id,
      'document_html', v_row.document_html,
      'note_updated_at', v_row.note_updated_at,
      'revision', v_row.revision,
      'client_id', v_row.client_id,
      'updated_at', v_row.updated_at
    );
  end if;

  return jsonb_build_object(
    'status', 'missing',
    'workspace_key', p_workspace_key,
    'ward_id', p_ward_id,
    'note_id', p_note_id,
    'revision', 0
  );
end;
$$;

revoke all on function public.shiftpad_commit_note_document(text, text, text, text, bigint, bigint, text) from public, anon;
grant execute on function public.shiftpad_commit_note_document(text, text, text, text, bigint, bigint, text) to authenticated, service_role;

insert into public.shiftpad_note_documents (
  user_id,
  workspace_key,
  ward_id,
  note_id,
  document_html,
  note_updated_at,
  revision,
  client_id
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
  document.user_id,
  document.workspace_key,
  document.ward_id,
  document.note_id,
  document.document_html,
  document.note_updated_at,
  document.revision,
  document.client_id,
  document.updated_at
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
