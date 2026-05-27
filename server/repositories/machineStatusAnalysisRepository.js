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
      statusCount: 0,
      latestIntervalAt: null
    },
    availableMachines: [],
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

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function addMinutes(target, key, minutes) {
  const existing = target.get(key) || 0;
  target.set(key, existing + minutes);
}

function buildDisplayRows(rows, since, until) {
  const grouped = new Map();

  for (const row of rows) {
    const machineRows = grouped.get(row.machine_id) || [];
    machineRows.push(row);
    grouped.set(row.machine_id, machineRows);
  }

  const statusTotals = new Map();
  const machineBreakdown = new Map();
  const recentIntervals = [];
  let latestIntervalAt = null;

  for (const [machineId, machineRows] of grouped.entries()) {
    const sortedRows = machineRows.sort((left, right) => {
      const leftTime = left.fetched_at?.getTime?.() || 0;
      const rightTime = right.fetched_at?.getTime?.() || 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return (left.id || 0) - (right.id || 0);
    });

    const machineTotals = new Map();

    for (let index = 0; index < sortedRows.length; index += 1) {
      const row = sortedRows[index];
      const nextRow = sortedRows[index + 1] || null;
      const intervalStart = row.fetched_at;
      const intervalEnd = nextRow?.fetched_at || until;

      const clippedStart = new Date(Math.max(intervalStart.getTime(), since.getTime()));
      const clippedEnd = new Date(Math.min(intervalEnd.getTime(), until.getTime()));

      if (clippedEnd.getTime() <= clippedStart.getTime()) {
        continue;
      }

      const minutes = (clippedEnd.getTime() - clippedStart.getTime()) / 60000;
      const statusDescription = row.status_description || "Unknown";

      addMinutes(statusTotals, statusDescription, minutes);
      addMinutes(machineTotals, statusDescription, minutes);

      latestIntervalAt =
        !latestIntervalAt || clippedEnd.getTime() > latestIntervalAt.getTime()
          ? clippedEnd
          : latestIntervalAt;

      recentIntervals.push({
        machineId,
        statusDescription,
        statusCode: row.status_code,
        eventType: row.event_type,
        jobCode: row.job_code,
        operationCode: row.operation_code,
        eventStartTime: normalizeTimestamp(row.event_start_time),
        eventSeqCode: row.event_seq_code,
        startAt: normalizeTimestamp(clippedStart),
        endAt: normalizeTimestamp(clippedEnd),
        minutes
      });
    }

    const statusTotalsRows = Array.from(machineTotals.entries())
      .map(([statusDescription, trackedMinutes]) => ({
        statusDescription,
        trackedMinutes,
        share: 0
      }))
      .sort(
        (left, right) =>
          right.trackedMinutes - left.trackedMinutes ||
          left.statusDescription.localeCompare(right.statusDescription)
      );

    const machineTrackedMinutes = statusTotalsRows.reduce(
      (sum, row) => sum + row.trackedMinutes,
      0
    );

    machineBreakdown.set(machineId, {
      machineId,
      trackedMinutes: machineTrackedMinutes,
      statusTotals: statusTotalsRows.map((row) => ({
        ...row,
        share: machineTrackedMinutes > 0 ? row.trackedMinutes / machineTrackedMinutes : 0
      }))
    });
  }

  const statusTotalsRows = Array.from(statusTotals.entries())
    .map(([statusDescription, trackedMinutes]) => ({
      statusDescription,
      trackedMinutes,
      share: 0
    }))
    .sort(
      (left, right) =>
        right.trackedMinutes - left.trackedMinutes ||
        left.statusDescription.localeCompare(right.statusDescription)
    );

  const totalTrackedMinutes = statusTotalsRows.reduce((sum, row) => sum + row.trackedMinutes, 0);

  return {
    summary: {
      machineCount: machineBreakdown.size,
      trackedMinutes: totalTrackedMinutes,
      statusCount: statusTotalsRows.length,
      latestIntervalAt: normalizeTimestamp(latestIntervalAt)
    },
    statusTotals: statusTotalsRows.map((row) => ({
      ...row,
      share: totalTrackedMinutes > 0 ? row.trackedMinutes / totalTrackedMinutes : 0
    })),
    machineBreakdown: Array.from(machineBreakdown.values()).sort(
      (left, right) => right.trackedMinutes - left.trackedMinutes || left.machineId.localeCompare(right.machineId)
    ),
    recentIntervals: recentIntervals
      .sort((left, right) => {
        const leftTime = new Date(left.endAt || left.startAt || 0).getTime();
        const rightTime = new Date(right.endAt || right.startAt || 0).getTime();
        if (rightTime !== leftTime) {
          return rightTime - leftTime;
        }

        return left.machineId.localeCompare(right.machineId);
      })
      .slice(0, 60)
  };
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
  const requestedUntil = isValidDate(until) ? until : now;
  const requestedSince = isValidDate(since)
    ? since
    : new Date(requestedUntil.getTime() - windowHours * 60 * 60 * 1000);
  const rangeLimitMs = 31 * 24 * 60 * 60 * 1000;
  const effectiveSince =
    requestedUntil.getTime() - requestedSince.getTime() > rangeLimitMs
      ? new Date(requestedUntil.getTime() - rangeLimitMs)
      : requestedSince;
  const selectedMachineIds = Array.isArray(machineIds) && machineIds.length > 0 ? machineIds : null;

  const machineFilterSql = selectedMachineIds ? "and machine_id = any($3::text[])" : "";
  const params = selectedMachineIds ? [effectiveSince, requestedUntil, selectedMachineIds] : [effectiveSince, requestedUntil];

  const [historyResult, machineResult] = await Promise.all([
    db.query(
      `
        with prior_rows as (
          select distinct on (machine_id)
            id,
            machine_id,
            fetched_at,
            status_description,
            status_code,
            event_type,
            job_code,
            operation_code,
            event_start_time,
            event_seq_code
          from machine_status_history
          where fetched_at < $1
          ${machineFilterSql}
          order by machine_id, fetched_at desc, id desc
        ),
        window_rows as (
          select
            id,
            machine_id,
            fetched_at,
            status_description,
            status_code,
            event_type,
            job_code,
            operation_code,
            event_start_time,
            event_seq_code
          from machine_status_history
          where fetched_at >= $1
            and fetched_at <= $2
          ${machineFilterSql}
        )
        select * from prior_rows
        union all
        select * from window_rows
        order by machine_id asc, fetched_at asc, id asc
      `,
      params
    ),
    db.query(
      `
        select distinct machine_id
        from machine_status_history
        order by machine_id asc
      `
    )
  ]);

  const rows = historyResult.rows.map((row) => ({
    id: row.id,
    machine_id: row.machine_id,
    fetched_at: row.fetched_at,
    status_description: row.status_description,
    status_code: row.status_code,
    event_type: row.event_type,
    job_code: row.job_code,
    operation_code: row.operation_code,
    event_start_time: row.event_start_time,
    event_seq_code: row.event_seq_code
  }));

  const display = buildDisplayRows(rows, effectiveSince, requestedUntil);

  return {
    databaseConfigured: true,
    generatedAt: now.toISOString(),
    windowHours,
    since: effectiveSince.toISOString(),
    until: requestedUntil.toISOString(),
    summary: display.summary,
    availableMachines: machineResult.rows.map((row) => row.machine_id),
    statusTotals: display.statusTotals,
    machineBreakdown: display.machineBreakdown,
    recentIntervals: display.recentIntervals
  };
}
