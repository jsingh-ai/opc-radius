import { getPool, isDatabaseConfigured } from "../db/index.js";

function buildEmptyAnalysis(windowHours) {
  const generatedAt = new Date().toISOString();

  return {
    databaseConfigured: false,
    generatedAt,
    windowHours,
    since: generatedAt,
    until: generatedAt,
    summary: {
      machineCount: 0,
      trackedMinutes: 0,
      statusCount: 0
    },
    statusTotals: [],
    machineBreakdown: [],
    recentIntervals: []
  };
}

function normalizeTimestamp(value) {
  return value?.toISOString?.() || null;
}

function toNumber(value) {
  return Number(value || 0);
}

export async function getMachineStatusAnalysis({
  since,
  until,
  windowHours = 24,
  machineIds = null
} = {}) {
  if (!isDatabaseConfigured()) {
    return buildEmptyAnalysis(windowHours);
  }

  const db = getPool();
  const now = new Date();
  const requestedUntil = until instanceof Date && !Number.isNaN(until.getTime()) ? until : now;
  const requestedSince =
    since instanceof Date && !Number.isNaN(since.getTime())
      ? since
      : new Date(requestedUntil.getTime() - windowHours * 60 * 60 * 1000);
  const rangeLimitMs = 31 * 24 * 60 * 60 * 1000;
  const effectiveSince =
    requestedUntil.getTime() - requestedSince.getTime() > rangeLimitMs
      ? new Date(requestedUntil.getTime() - rangeLimitMs)
      : requestedSince;
  const selectedMachineIds = Array.isArray(machineIds) && machineIds.length > 0 ? machineIds : null;

  const intervalsSql = `
    with bounds as (
      select $1::timestamptz as since, $2::timestamptz as until
    ),
    prior_state as (
      select distinct on (h.machine_id)
        h.machine_id,
        h.fetched_at,
        h.status_description,
        h.status_code,
        h.event_type,
        h.job_code,
        h.operation_code,
        h.event_start_time,
        h.event_seq_code,
        h.id
      from machine_status_history h
      join bounds b on h.fetched_at < b.since
      where ($3::text[] is null or h.machine_id = any($3::text[]))
      order by h.machine_id, h.fetched_at desc, h.id desc
    ),
    window_state as (
      select
        h.machine_id,
        h.fetched_at,
        h.status_description,
        h.status_code,
        h.event_type,
        h.job_code,
        h.operation_code,
        h.event_start_time,
        h.event_seq_code,
        h.id
      from machine_status_history h
      join bounds b on h.fetched_at >= b.since and h.fetched_at <= b.until
      where ($3::text[] is null or h.machine_id = any($3::text[]))
    ),
    timeline as (
      select * from prior_state
      union all
      select * from window_state
    ),
    ordered as (
      select
        machine_id,
        fetched_at as interval_start,
        lead(fetched_at) over (
          partition by machine_id
          order by fetched_at asc, id asc
        ) as interval_end,
        status_description,
        status_code,
        event_type,
        job_code,
        operation_code,
        event_start_time,
        event_seq_code
      from timeline
    ),
    intervals as (
      select
        o.machine_id,
        o.status_description,
        o.status_code,
        o.event_type,
        o.job_code,
        o.operation_code,
        o.event_start_time,
        o.event_seq_code,
        greatest(o.interval_start, b.since) as clipped_start,
        least(coalesce(o.interval_end, b.until), b.until) as clipped_end,
        extract(
          epoch from (
            least(coalesce(o.interval_end, b.until), b.until)
            - greatest(o.interval_start, b.since)
          )
        ) / 60.0 as minutes
      from ordered o
      cross join bounds b
      where o.interval_start < b.until
        and coalesce(o.interval_end, b.until) > b.since
        and least(coalesce(o.interval_end, b.until), b.until) > greatest(o.interval_start, b.since)
    )
  `;

  const [summaryResult, statusTotalsResult, machineBreakdownResult, recentIntervalsResult] =
    await Promise.all([
      db.query(
        `
          ${intervalsSql}
          select
            count(distinct machine_id)::int as machine_count,
            coalesce(sum(minutes), 0)::numeric as tracked_minutes,
            count(distinct coalesce(status_description, 'Unknown'))::int as status_count,
            max(clipped_end) as latest_interval_at
          from intervals
        `,
        [effectiveSince, requestedUntil, selectedMachineIds]
      ),
      db.query(
        `
          ${intervalsSql}
          select
            coalesce(status_description, 'Unknown') as status_description,
            sum(minutes)::numeric as tracked_minutes
          from intervals
          group by coalesce(status_description, 'Unknown')
          order by tracked_minutes desc, status_description asc
        `,
        [effectiveSince, requestedUntil, selectedMachineIds]
      ),
      db.query(
        `
          ${intervalsSql}
          with per_machine as (
            select
              machine_id,
              coalesce(status_description, 'Unknown') as status_description,
              sum(minutes)::numeric as tracked_minutes
            from intervals
            group by machine_id, coalesce(status_description, 'Unknown')
          ),
          machine_totals as (
            select
              machine_id,
              sum(tracked_minutes)::numeric as total_minutes
            from per_machine
            group by machine_id
          )
          select
            p.machine_id,
            p.status_description,
            p.tracked_minutes,
            m.total_minutes
          from per_machine p
          join machine_totals m using (machine_id)
          order by m.total_minutes desc, p.machine_id asc, p.tracked_minutes desc, p.status_description asc
        `,
        [effectiveSince, requestedUntil, selectedMachineIds]
      ),
      db.query(
        `
          ${intervalsSql}
          select
            machine_id,
            coalesce(status_description, 'Unknown') as status_description,
            status_code,
            event_type,
            job_code,
            operation_code,
            event_start_time,
            event_seq_code,
            clipped_start,
            clipped_end,
            minutes
          from intervals
          order by clipped_end desc, machine_id asc
          limit 60
        `,
        [effectiveSince, requestedUntil, selectedMachineIds]
      )
    ]);

  const summaryRow = summaryResult.rows[0] || {};
  const totalTrackedMinutes = toNumber(summaryRow.tracked_minutes);
  const statusTotals = statusTotalsResult.rows.map((row) => {
    const trackedMinutes = toNumber(row.tracked_minutes);

    return {
      statusDescription: row.status_description,
      trackedMinutes,
      share: totalTrackedMinutes > 0 ? trackedMinutes / totalTrackedMinutes : 0
    };
  });

  const machineMap = new Map();

  for (const row of machineBreakdownResult.rows) {
    const machineId = row.machine_id;
    const trackedMinutes = toNumber(row.tracked_minutes);
    const totalMinutes = toNumber(row.total_minutes);
    const existing = machineMap.get(machineId) || {
      machineId,
      trackedMinutes: totalMinutes,
      statusTotals: []
    };

    existing.trackedMinutes = totalMinutes;
    existing.statusTotals.push({
      statusDescription: row.status_description,
      trackedMinutes,
      share: totalMinutes > 0 ? trackedMinutes / totalMinutes : 0
    });
    machineMap.set(machineId, existing);
  }

  return {
    databaseConfigured: true,
    generatedAt: now.toISOString(),
    windowHours,
    since: effectiveSince.toISOString(),
    until: requestedUntil.toISOString(),
    summary: {
      machineCount: toNumber(summaryRow.machine_count),
      trackedMinutes: totalTrackedMinutes,
      statusCount: toNumber(summaryRow.status_count),
      latestIntervalAt: normalizeTimestamp(summaryRow.latest_interval_at)
    },
    statusTotals,
    machineBreakdown: Array.from(machineMap.values()).map((machine) => ({
      ...machine,
      statusTotals: machine.statusTotals.sort(
        (left, right) => right.trackedMinutes - left.trackedMinutes || left.statusDescription.localeCompare(right.statusDescription)
      )
    })),
    recentIntervals: recentIntervalsResult.rows.map((row) => ({
      machineId: row.machine_id,
      statusDescription: row.status_description,
      statusCode: row.status_code,
      eventType: row.event_type,
      jobCode: row.job_code,
      operationCode: row.operation_code,
      eventStartTime: normalizeTimestamp(row.event_start_time),
      eventSeqCode: row.event_seq_code,
      startAt: normalizeTimestamp(row.clipped_start),
      endAt: normalizeTimestamp(row.clipped_end),
      minutes: toNumber(row.minutes)
    }))
  };
}
