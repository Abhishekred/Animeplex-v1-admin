-- AnimePlex Admin Control Center
-- Apply to the existing AnimePlex Supabase project after reviewing this file.
-- No user backup payloads or secrets are copied into the admin schema.

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','release_manager','moderator','auditor')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_actor_idx on public.admin_audit_logs(actor_id, created_at desc);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  type text not null default 'info' check (type in ('info','warning','update')),
  is_active boolean not null default true,
  action_url text check (action_url is null or action_url ~* '^https?://'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  version_code bigint not null,
  platform text not null default 'android' check (platform in ('android','android_tv')),
  channel text not null default 'stable' check (channel in ('stable','beta','testing')),
  mandatory boolean not null default false,
  rollout_percent integer not null default 5 check (rollout_percent between 1 and 100),
  release_notes text not null default '',
  storage_path text not null,
  download_url text,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  file_size bigint check (file_size is null or file_size >= 0),
  status text not null default 'draft' check (status in ('draft','published','paused','rolled_back')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists app_releases_channel_version_idx on public.app_releases(channel, version_code desc);
create index if not exists app_releases_status_idx on public.app_releases(status, created_at desc);
create unique index if not exists app_releases_channel_build_unique on public.app_releases(platform, channel, version_code);

alter table public.admin_members enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_announcements enable row level security;
alter table public.app_releases enable row level security;

-- No browser role policies: all admin-table reads/writes go through the Vercel
-- API using the service-role key after verifying the caller's Supabase JWT and
-- active admin_members row. Never ship the service-role key to Vite.
revoke all on public.admin_members from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
revoke all on public.app_announcements from anon, authenticated;
revoke all on public.app_releases from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animeplex-releases','animeplex-releases',true,2147483648,array['application/vnd.android.package-archive','application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload URLs are created only by the server-side service role. Public read is
-- required for APK downloads until the mobile client gains signed URL support.

-- Transactional cleanup for account deletion. Optional app tables are checked
-- at runtime because some legacy reading/sync migrations are applied manually.
create or replace function public.admin_purge_user_data(p_user_key text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $admin_purge$
begin
  delete from public.mylist where user_key = p_user_key;
  delete from public.history where user_key = p_user_key;
  delete from public.backups where user_key = p_user_key;
  delete from public.watch_rooms where host_key = p_user_key;
  update public.tv_pairings
    set app_user_id = null, app_secret = null, tracker_blob = null
    where app_user_id = p_user_id::text;

  if to_regclass('public.reading_history') is not null then
    execute 'delete from public.reading_history where user_key = $1' using p_user_key;
  end if;
  if to_regclass('public.viewer_profiles') is not null then
    execute 'delete from public.viewer_profiles where user_key = $1' using p_user_key;
  end if;
  if to_regclass('public.mylist_sync_clock') is not null then
    execute 'delete from public.mylist_sync_clock where user_key = $1' using p_user_key;
  end if;
  if to_regclass('public.mylist_sync_tombstones') is not null then
    execute 'delete from public.mylist_sync_tombstones where user_key = $1' using p_user_key;
  end if;
  if to_regclass('public.list_categories') is not null then
    execute 'delete from public.list_categories where user_key = $1' using p_user_key;
  end if;
  if to_regclass('public.mylist_categories') is not null then
    execute 'delete from public.mylist_categories where user_key = $1' using p_user_key;
  end if;
  if to_regclass('sync_private.history_bridge_events') is not null then
    execute 'delete from sync_private.history_bridge_events where user_key = $1' using p_user_key;
  end if;
  if to_regclass('sync_private.library_bridge_events') is not null then
    execute 'delete from sync_private.library_bridge_events where user_key = $1' using p_user_key;
  end if;
  if to_regclass('sync_private.content_bridge_events') is not null then
    execute 'delete from sync_private.content_bridge_events where user_key = $1' using p_user_key;
  end if;
end;
$admin_purge$;
revoke all on function public.admin_purge_user_data(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_user_data(text, uuid) to service_role;

create table if not exists public.app_featured_content (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  category text not null default 'featured',
  image_url text check (image_url is null or image_url ~* '^https?://'),
  target_url text check (target_url is null or target_url ~* '^https?://'),
  position integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_featured_content_order_idx on public.app_featured_content(is_active, position, created_at desc);
alter table public.app_featured_content enable row level security;
revoke all on public.app_featured_content from anon, authenticated;

create table if not exists public.admin_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, window_start)
);
alter table public.admin_rate_limit_buckets enable row level security;
revoke all on public.admin_rate_limit_buckets from anon, authenticated;

create or replace function public.admin_rate_limit_check(p_user_id uuid, p_max_requests integer default 120)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $admin_rate$
declare
  v_count integer;
  v_window timestamptz := date_trunc('minute', clock_timestamp());
begin
  insert into public.admin_rate_limit_buckets(user_id, window_start, request_count)
  values (p_user_id, v_window, 1)
  on conflict (user_id, window_start) do update
    set request_count = public.admin_rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  delete from public.admin_rate_limit_buckets
    where window_start < v_window - interval '1 day';

  return v_count <= greatest(1, least(p_max_requests, 500));
end;
$admin_rate$;
revoke all on function public.admin_rate_limit_check(uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_rate_limit_check(uuid, integer) to service_role;

-- Explicit server-role grants: RLS bypass does not replace SQL privileges.
grant all on public.admin_members, public.admin_audit_logs, public.app_settings,
  public.app_announcements, public.app_releases, public.app_featured_content,
  public.admin_rate_limit_buckets to service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;
