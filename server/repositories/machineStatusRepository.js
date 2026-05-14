import { getPool, isDatabaseConfigured } from "../db/index.js";

function normalizeTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function saveMachineStatusSnapshot({ fetchedAt, source, data }) {
  if (!isDatabaseConfigured()) {
    return { persisted: false, reason: "database_not_configured" };
  }

  const db = getPool();
  const client = await db.connect();

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
        Array.isArray(data) ? data.length : 0,
        JSON.stringify({
          source,
          data
        })
      ]
    );

    if (Array.isArray(data)) {
      for (const row of data) {
        await client.query(
          `
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
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12::jsonb)
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
            row.machineId,
            row.kco ?? null,
            row.plantCode ?? null,
            row.jobCode ?? null,
            row.operationCode ?? null,
            row.eventType ?? null,
            row.statusCode ?? null,
            row.statusDescription ?? null,
            normalizeTimestamp(row.eventStartTime),
            row.eventSeqCode ?? null,
            fetchedAt,
            JSON.stringify(row)
          ]
        );
      }
    }

    await client.query("commit");
    return { persisted: true, count: Array.isArray(data) ? data.length : 0 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
