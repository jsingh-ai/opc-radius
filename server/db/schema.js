export const schemaSql = `
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
`;
