import { getPool, isDatabaseConfigured } from "../db/index.js";
const SCHEDULER_LOCK_FAMILY = 8241;
const SCHEDULER_LOCK_RESOURCE = 1;

function deduplicateMachineRows(data) {
  const deduplicated = new Map();

  for (const row of Array.isArray(data) ? data : []) {
    if (!row?.machineId) {
      continue;
    }

    // Keep the most recent row in the payload for each machine key so the bulk
    // upsert cannot hit the same primary key twice in one statement.
    deduplicated.set(row.machineId, row);
  }

  return Array.from(deduplicated.values());
}

export async function saveMachineStatusSnapshot({ fetchedAt, source, data }) {
  if (!isDatabaseConfigured()) {
    return { persisted: false, reason: "database_not_configured" };
  }

  const db = getPool();
  const client = await db.connect();
  const normalizedData = deduplicateMachineRows(data);

  try {
    await client.query("begin");

    await client.query(
      `
        insert into machine_status_fetches (source, fetched_at, machine_count, payload)
        values ($1, $2, $3, $4::jsonb)
      `,
      [
        "shopfloor-current-status",
        fetchedAt,
        normalizedData.length,
        JSON.stringify({
          source,
          data: normalizedData
        })
      ]
    );

    await client.query(
      `
        insert into machine_status_history (
          fetched_at,
          machine_id,
          kco,
          plant_code,
          job_code,
          operation_code,
          event_type,
          status_code,
          status_description,
          event_start_time,
          event_seq_code,
          raw_payload
        )
        select
          fetched_at,
          machine_id,
          kco,
          plant_code,
          job_code,
          operation_code,
          event_type,
          status_code,
          status_description,
          event_start_time,
          event_seq_code,
          raw_payload
        from jsonb_to_recordset($1::jsonb) as x(
          fetched_at timestamptz,
          machine_id text,
          kco integer,
          plant_code text,
          job_code text,
          operation_code text,
          event_type text,
          status_code text,
          status_description text,
          event_start_time timestamptz,
          event_seq_code text,
          raw_payload jsonb
        )
      `,
      [
        JSON.stringify(
          normalizedData.map((row) => ({
            fetched_at: fetchedAt,
            machine_id: row.machineId,
            kco: row.kco ?? null,
            plant_code: row.plantCode ?? null,
            job_code: row.jobCode ?? null,
            operation_code: row.operationCode ?? null,
            event_type: row.eventType ?? null,
            status_code: row.statusCode ?? null,
            status_description: row.statusDescription ?? null,
            event_start_time: row.eventStartTime ?? null,
            event_seq_code: row.eventSeqCode ?? null,
            raw_payload: row
          }))
        )
      ]
    );

    await client.query(
      `
        with incoming as (
          select *
          from jsonb_to_recordset($1::jsonb) as x(
            machine_id text,
            kco integer,
            plant_code text,
            job_code text,
            operation_code text,
            event_type text,
            status_code text,
            status_description text,
            event_start_time timestamptz,
            event_seq_code text,
            last_fetched_at timestamptz,
            raw_payload jsonb
          )
        )
        insert into machine_status_current (
          machine_id,
          kco,
          plant_code,
          job_code,
          operation_code,
          event_type,
          status_code,
          status_description,
          event_start_time,
          event_seq_code,
          last_fetched_at,
          updated_at,
          raw_payload
        )
        select
          machine_id,
          kco,
          plant_code,
          job_code,
          operation_code,
          event_type,
          status_code,
          status_description,
          event_start_time,
          event_seq_code,
          last_fetched_at,
          now(),
          raw_payload
        from incoming
        on conflict (machine_id) do update set
          kco = excluded.kco,
          plant_code = excluded.plant_code,
          job_code = excluded.job_code,
          operation_code = excluded.operation_code,
          event_type = excluded.event_type,
          status_code = excluded.status_code,
          status_description = excluded.status_description,
          event_start_time = excluded.event_start_time,
          event_seq_code = excluded.event_seq_code,
          last_fetched_at = excluded.last_fetched_at,
          updated_at = now(),
          raw_payload = excluded.raw_payload
      `,
      [
        JSON.stringify(
          normalizedData.map((row) => ({
            machine_id: row.machineId,
            kco: row.kco ?? null,
            plant_code: row.plantCode ?? null,
            job_code: row.jobCode ?? null,
            operation_code: row.operationCode ?? null,
            event_type: row.eventType ?? null,
            status_code: row.statusCode ?? null,
            status_description: row.statusDescription ?? null,
            event_start_time: row.eventStartTime ?? null,
            event_seq_code: row.eventSeqCode ?? null,
            last_fetched_at: fetchedAt,
            raw_payload: row
          }))
        )
      ]
    );

    await client.query("commit");
    return { persisted: true, count: normalizedData.length };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentMachineStatuses() {
  if (!isDatabaseConfigured()) {
    return {
      fetchedAt: null,
      source: null,
      machines: []
    };
  }

  const db = getPool();
  const [currentResult, fetchResult] = await Promise.all([
    db.query(
      `
        select
          machine_id,
          kco,
          plant_code,
          job_code,
          operation_code,
          event_type,
          status_code,
          status_description,
          event_start_time,
          event_seq_code,
          last_fetched_at
        from machine_status_current
        order by machine_id asc
      `
    ),
    db.query(
      `
        select fetched_at, payload
        from machine_status_fetches
        order by fetched_at desc
        limit 1
      `
    )
  ]);

  const latestFetch = fetchResult.rows[0] || null;
  const source = latestFetch?.payload?.source || null;

  return {
    fetchedAt: latestFetch?.fetched_at?.toISOString?.() || null,
    source,
    machines: currentResult.rows.map((row) => ({
      kco: row.kco,
      plantCode: row.plant_code,
      machineId: row.machine_id,
      jobCode: row.job_code,
      operationCode: row.operation_code,
      eventType: row.event_type,
      statusCode: row.status_code,
      statusDescription: row.status_description,
      eventStartTime: row.event_start_time?.toISOString?.() || null,
      eventSeqCode: row.event_seq_code,
      lastFetchedAt: row.last_fetched_at?.toISOString?.() || null
    }))
  };
}

export async function acquireSchedulerLock() {
  const db = getPool();
  const client = await db.connect();

  try {
    const result = await client.query(
      "select pg_try_advisory_lock($1, $2) as locked",
      [SCHEDULER_LOCK_FAMILY, SCHEDULER_LOCK_RESOURCE]
    );

    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }

    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function releaseSchedulerLock(client) {
  if (!client) {
    return;
  }

  try {
    await client.query("select pg_advisory_unlock($1, $2)", [
      SCHEDULER_LOCK_FAMILY,
      SCHEDULER_LOCK_RESOURCE
    ]);
  } finally {
    client.release();
  }
}
