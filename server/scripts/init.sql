create table if not exists machine_status_fetches (
  id bigserial primary key,
  source text not null,
  fetched_at timestamptz not null,
  machine_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists machine_status_current (
  machine_id text primary key,
  kco integer,
  plant_code text,
  job_code text,
  operation_code text,
  event_type text,
  status_code text,
  status_description text,
  event_start_time timestamptz,
  event_seq_code text,
  last_fetched_at timestamptz not null,
  updated_at timestamptz not null default now(),
  raw_payload jsonb not null
);

create index if not exists idx_machine_status_fetches_fetched_at
  on machine_status_fetches (fetched_at desc);

create index if not exists idx_machine_status_current_status_description
  on machine_status_current (status_description);

create table if not exists dashboard_view_sessions (
  session_id text primary key,
  current_path text not null,
  page_title text,
  theme text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  last_unloaded_at timestamptz,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_dashboard_view_sessions_last_seen_at
  on dashboard_view_sessions (last_seen_at desc);

create index if not exists idx_dashboard_view_sessions_current_path
  on dashboard_view_sessions (current_path);
