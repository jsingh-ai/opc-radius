import { getPool, isDatabaseConfigured } from "../db/index.js";

const MAX_INTERVAL_MINUTES = 2;

function buildEmptyAnalysis(windowHours) {
  const generatedAt = new Date().toISOString();

  return {
    databaseConfigured: false,
    generatedAt,
    windowHours,
    since: generatedAt,
    until: generatedAt,
    availableMachines: [],
    intervals: [],
    summary: {
      goodMinutes: 0,
      setupMinutes: 0,
      downtimeMinutes: 0,
      totalObservedMinutes: 0,
      totalObservedHours: 0,
      goodPercent: 0,
      setupPercent: 0,
      downtimePercent: 0,
      biggestLossReason: "--",
      worstSelectedPress: "--",
      bestSelectedPress: "--",
      sampleCount: 0
    },
    debug: {
      source: "machine_status_history",
      historyRowCount: 0,
      availableMachineCount: 0,
      selectedMachineCount: 0,
      effectiveSince: generatedAt,
      requestedUntil: generatedAt,
      note: "Database is not configured in this app."
    }
  };
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeTimestamp(value) {
  return value?.toISOString?.() || null;
}

function toNumber(value) {
  return Number(value || 0);
}

function safeText(value, fallback) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

function getBusinessState(eventType) {
  const normalized = safeText(eventType, "").toUpperCase();

  if (normalized === "G") {
    return "good";
  }

  if (normalized === "M") {
    return "setup";
  }

  if (normalized === "B" || normalized === "S") {
    return "downtime";
  }

  return "downtime";
}

function getBusinessStateLabel(state) {
  if (state === "good") {
    return "Good";
  }

  if (state === "setup") {
    return "Setup";
  }

  return "Downtime";
}

function getBusinessStateColor(state) {
  if (state === "good") {
    return "good";
  }

  if (state === "setup") {
    return "setup";
  }

  return "downtime";
}

function getPressLabel(machineId) {
  const digits = String(machineId || "").replace(/\D/g, "");
  if (digits === "201") {
    return "Press 2";
  }

  const pressNumber = Number(digits.slice(-2));
  if (Number.isNaN(pressNumber) || pressNumber <= 0) {
    return `Press ${machineId}`;
  }

  if (pressNumber === 1) {
    return "Press 2";
  }

  return `Press ${pressNumber}`;
}

function getSafeJob(jobCode) {
  return safeText(jobCode, "Non Productive / Unknown Job");
}

function getSafeOperator(operationCode) {
  return safeText(operationCode, "Unknown Operator");
}

function capIntervalMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }

  return Math.min(minutes, MAX_INTERVAL_MINUTES);
}

function toDayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function summarizeTotals(totals) {
  const totalObservedMinutes =
    totals.goodMinutes + totals.setupMinutes + totals.downtimeMinutes;

  return {
    ...totals,
    totalObservedMinutes,
    totalObservedHours: totalObservedMinutes / 60,
    goodPercent: totalObservedMinutes > 0 ? totals.goodMinutes / totalObservedMinutes : 0,
    setupPercent: totalObservedMinutes > 0 ? totals.setupMinutes / totalObservedMinutes : 0,
    downtimePercent: totalObservedMinutes > 0 ? totals.downtimeMinutes / totalObservedMinutes : 0
  };
}

function getTopLossReason(rows) {
  const buckets = new Map();

  for (const row of rows) {
    if (row.businessState === "good") {
      continue;
    }

    const key = row.statusDescription;
    const next = buckets.get(key) || { statusDescription: key, minutes: 0 };
    next.minutes += row.minutes;
    buckets.set(key, next);
  }

  const top = Array.from(buckets.values()).sort(
    (left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription)
  )[0];

  return top ? top.statusDescription : "--";
}

function aggregateBy(rows, keySelector, options = {}) {
  const buckets = new Map();

  for (const row of rows) {
    const key = keySelector(row);
    const bucket = buckets.get(key) || {
      key,
      label: key,
      sampleCount: 0,
      goodMinutes: 0,
      setupMinutes: 0,
      downtimeMinutes: 0,
      totalMinutes: 0,
      statusBuckets: new Map(),
      eventTypeBuckets: new Map(),
      operatorBuckets: new Map(),
      jobBuckets: new Map()
    };

    bucket.sampleCount += 1;
    bucket.totalMinutes += row.minutes;

    if (row.businessState === "good") {
      bucket.goodMinutes += row.minutes;
    } else if (row.businessState === "setup") {
      bucket.setupMinutes += row.minutes;
    } else {
      bucket.downtimeMinutes += row.minutes;
    }

    const statusBucket = bucket.statusBuckets.get(row.statusDescription) || 0;
    bucket.statusBuckets.set(row.statusDescription, statusBucket + row.minutes);

    const eventBucket = bucket.eventTypeBuckets.get(row.eventType) || 0;
    bucket.eventTypeBuckets.set(row.eventType, eventBucket + row.minutes);

    const operatorBucket = bucket.operatorBuckets.get(row.operationCode) || 0;
    bucket.operatorBuckets.set(row.operationCode, operatorBucket + row.minutes);

    const jobBucket = bucket.jobBuckets.get(row.jobCode) || 0;
    bucket.jobBuckets.set(row.jobCode, jobBucket + row.minutes);

    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((bucket) => {
    const totalMinutes = bucket.totalMinutes;
    const statusRows = Array.from(bucket.statusBuckets.entries())
      .map(([statusDescription, minutes]) => ({ statusDescription, minutes }))
      .sort((left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription));

    const eventRows = Array.from(bucket.eventTypeBuckets.entries())
      .map(([eventType, minutes]) => ({ eventType: eventType || "Unknown", minutes }))
      .sort((left, right) => right.minutes - left.minutes || left.eventType.localeCompare(right.eventType));

    const operatorRows = Array.from(bucket.operatorBuckets.entries())
      .map(([operationCode, minutes]) => ({
        operationCode: getSafeOperator(operationCode),
        rawOperationCode: operationCode,
        minutes
      }))
      .sort((left, right) => right.minutes - left.minutes || left.operationCode.localeCompare(right.operationCode));

    const jobRows = Array.from(bucket.jobBuckets.entries())
      .map(([jobCode, minutes]) => ({
        jobCode: getSafeJob(jobCode),
        rawJobCode: jobCode,
        minutes
      }))
      .sort((left, right) => right.minutes - left.minutes || left.jobCode.localeCompare(right.jobCode));

    const topLoss = statusRows.find((row) => row.statusDescription && row.statusDescription !== "Run Production")
      || statusRows[0]
      || { statusDescription: "--", minutes: 0 };

    return {
      key: bucket.key,
      label: bucket.label,
      sampleCount: bucket.sampleCount,
      sampleHours: bucket.sampleCount / 60,
      goodMinutes: bucket.goodMinutes,
      setupMinutes: bucket.setupMinutes,
      downtimeMinutes: bucket.downtimeMinutes,
      totalMinutes,
      goodPercent: totalMinutes > 0 ? bucket.goodMinutes / totalMinutes : 0,
      setupPercent: totalMinutes > 0 ? bucket.setupMinutes / totalMinutes : 0,
      downtimePercent: totalMinutes > 0 ? bucket.downtimeMinutes / totalMinutes : 0,
      topLossReason: topLoss.statusDescription,
      topLossMinutes: topLoss.minutes,
      statusRows,
      eventRows,
      operatorRows,
      jobRows
    };
  });
}

function computeAnalysis(intervals, primaryMachineId, since, until, selectedMachineIds, availableMachines) {
  const summaryTotals = intervals.reduce(
    (totals, row) => {
      if (row.businessState === "good") {
        totals.goodMinutes += row.minutes;
      } else if (row.businessState === "setup") {
        totals.setupMinutes += row.minutes;
      } else {
        totals.downtimeMinutes += row.minutes;
      }
      return totals;
    },
    { goodMinutes: 0, setupMinutes: 0, downtimeMinutes: 0 }
  );

  const summary = summarizeTotals(summaryTotals);
  const pressComparison = aggregateBy(intervals, (row) => row.machineId);
  const dayBreakdown = aggregateBy(intervals, (row) => row.dayKey);
  const statusBreakdown = aggregateBy(intervals, (row) => row.statusDescription);
  const operatorBreakdown = aggregateBy(intervals, (row) => getSafeOperator(row.operationCode));
  const jobBreakdown = aggregateBy(intervals, (row) => getSafeJob(row.jobCode));
  const selectedPressIntervals = intervals.filter((row) => row.machineId === primaryMachineId);
  const selectedPressTimeline = {
    machineId: primaryMachineId,
    displayName: getPressLabel(primaryMachineId),
    intervals: selectedPressIntervals
  };

  const biggestLoss = Array.from(statusBreakdown)
    .filter((row) => row.label !== "Run Production")
    .sort((left, right) => right.downtimeMinutes - left.downtimeMinutes || right.totalMinutes - left.totalMinutes)[0];

  const worstSelectedPress = Array.from(pressComparison)
    .sort((left, right) => left.goodPercent - right.goodPercent || right.totalMinutes - left.totalMinutes)[0];
  const bestSelectedPress = Array.from(pressComparison)
    .sort((left, right) => right.goodPercent - left.goodPercent || right.totalMinutes - left.totalMinutes)[0];

  return {
    summary: {
      ...summary,
      biggestLossReason: biggestLoss ? biggestLoss.label : "--",
      worstSelectedPress: worstSelectedPress ? worstSelectedPress.label : "--",
      bestSelectedPress: bestSelectedPress ? bestSelectedPress.label : "--"
    },
    selected_press_timeline: selectedPressTimeline,
    press_comparison: pressComparison,
    day_breakdown: dayBreakdown,
    status_breakdown: statusBreakdown,
    operator_breakdown: operatorBreakdown,
    job_breakdown: jobBreakdown,
    filter_options: {
      machineIds: availableMachines,
      eventTypes: Array.from(new Set(intervals.map((row) => row.eventType).filter(Boolean))).sort(),
      statusDescriptions: Array.from(new Set(intervals.map((row) => row.statusDescription).filter(Boolean))).sort(),
      operationCodes: Array.from(new Set(intervals.map((row) => getSafeOperator(row.operationCode)).filter(Boolean))).sort(),
      jobCodes: Array.from(new Set(intervals.map((row) => getSafeJob(row.jobCode)).filter(Boolean))).sort()
    },
    debug: {
      source: "machine_status_history",
      historyRowCount: intervals.length,
      availableMachineCount: availableMachines.length,
      selectedMachineCount: selectedMachineIds.length,
      selectedMachineIds,
      effectiveSince: since.toISOString(),
      requestedUntil: until.toISOString(),
      primaryMachineId,
      note:
        intervals.length === 0
          ? "No rows were returned from machine_status_history for the selected filters."
          : "Interval rows were returned and analyzed in the application."
    }
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
  const params = selectedMachineIds
    ? [effectiveSince, requestedUntil, selectedMachineIds]
    : [effectiveSince, requestedUntil];

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

  const availableMachines = machineResult.rows.map((row) => row.machine_id);
  const primaryMachineId = availableMachines.includes("205")
    ? "205"
    : selectedMachineIds?.[0] || availableMachines[0] || "205";

  const rawRows = historyResult.rows.map((row) => ({
    id: row.id,
    machineId: String(row.machine_id),
    fetchedAt: row.fetched_at,
    statusDescription: safeText(row.status_description, "Unknown"),
    statusCode: safeText(row.status_code, ""),
    eventType: safeText(row.event_type, ""),
    jobCode: getSafeJob(row.job_code),
    operationCode: getSafeOperator(row.operation_code),
    eventStartTime: normalizeTimestamp(row.event_start_time),
    eventSeqCode: safeText(row.event_seq_code, ""),
    businessState: getBusinessState(row.event_type),
    businessStateLabel: getBusinessStateLabel(getBusinessState(row.event_type)),
    businessStateColor: getBusinessStateColor(getBusinessState(row.event_type))
  }));

  const intervalsByMachine = new Map();

  for (const row of rawRows) {
    const bucket = intervalsByMachine.get(row.machineId) || [];
    bucket.push(row);
    intervalsByMachine.set(row.machineId, bucket);
  }

  const intervals = [];
  let cappedGapCount = 0;
  let latestIntervalAt = null;

  for (const [machineId, rows] of intervalsByMachine.entries()) {
    const sortedRows = rows.sort((left, right) => {
      const leftTime = left.fetchedAt?.getTime?.() || 0;
      const rightTime = right.fetchedAt?.getTime?.() || 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return (left.id || 0) - (right.id || 0);
    });

    for (let index = 0; index < sortedRows.length; index += 1) {
      const current = sortedRows[index];
      const next = sortedRows[index + 1] || null;
      const intervalStart = current.fetchedAt;
      const rawEnd = next?.fetchedAt || requestedUntil;
      const deltaMinutes = (rawEnd.getTime() - intervalStart.getTime()) / 60000;
      const cappedMinutes = capIntervalMinutes(deltaMinutes);

      if (deltaMinutes > MAX_INTERVAL_MINUTES) {
        cappedGapCount += 1;
      }

      const intervalEnd = new Date(intervalStart.getTime() + cappedMinutes * 60000);
      const clippedStart = new Date(Math.max(intervalStart.getTime(), effectiveSince.getTime()));
      const clippedEnd = new Date(Math.min(intervalEnd.getTime(), requestedUntil.getTime()));

      if (clippedEnd.getTime() <= clippedStart.getTime()) {
        continue;
      }

      const minutes = (clippedEnd.getTime() - clippedStart.getTime()) / 60000;
      const dayKey = toDayKey(clippedStart);

      intervals.push({
        machineId,
        pressLabel: getPressLabel(machineId),
        fetchedAt: normalizeTimestamp(current.fetchedAt),
        startAt: normalizeTimestamp(clippedStart),
        endAt: normalizeTimestamp(clippedEnd),
        minutes,
        eventType: current.eventType,
        statusDescription: current.statusDescription,
        jobCode: current.jobCode,
        operationCode: current.operationCode,
        businessState: current.businessState,
        businessStateLabel: current.businessStateLabel,
        businessStateColor: current.businessStateColor,
        dayKey,
        statusCode: current.statusCode,
        eventSeqCode: current.eventSeqCode
      });

      latestIntervalAt =
        !latestIntervalAt || clippedEnd.getTime() > latestIntervalAt.getTime()
          ? clippedEnd
          : latestIntervalAt;
    }
  }

  intervals.sort((left, right) => {
    const leftTime = new Date(left.endAt || left.startAt || 0).getTime();
    const rightTime = new Date(right.endAt || right.startAt || 0).getTime();
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return left.machineId.localeCompare(right.machineId);
  });

  const analysis = computeAnalysis(
    intervals,
    primaryMachineId,
    effectiveSince,
    requestedUntil,
    selectedMachineIds || availableMachines,
    availableMachines
  );

  return {
    databaseConfigured: true,
    generatedAt: now.toISOString(),
    windowHours,
    since: effectiveSince.toISOString(),
    until: requestedUntil.toISOString(),
    availableMachines,
    primaryMachineId,
    intervals,
    summary: {
      ...analysis.summary,
      latestIntervalAt: normalizeTimestamp(latestIntervalAt)
    },
    selected_press_timeline: analysis.selected_press_timeline,
    press_comparison: analysis.press_comparison,
    day_breakdown: analysis.day_breakdown,
    status_breakdown: analysis.status_breakdown,
    operator_breakdown: analysis.operator_breakdown,
    job_breakdown: analysis.job_breakdown,
    filter_options: analysis.filter_options,
    debug: {
      ...analysis.debug,
      cappedGapCount,
      rawRowCount: rawRows.length,
      intervalCount: intervals.length,
      latestIntervalAt: normalizeTimestamp(latestIntervalAt),
      note: intervals.length === 0
        ? "No rows were returned from machine_status_history for the selected filters."
        : "Rows were returned and converted into capped one-minute intervals."
    }
  };
}
