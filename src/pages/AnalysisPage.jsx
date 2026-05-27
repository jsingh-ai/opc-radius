import { useEffect, useMemo, useState } from "react";
import { usePageHeader } from "../context/PageHeaderContext";
import { useMachineStatusAnalysis } from "../hooks/useMachineStatusAnalysis";
import {
  formatDurationMinutes,
  formatMachineDisplayName,
  formatPercent
} from "../utils/formatters";
import "../styles/analysis.css";

const BUSINESS_STATE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Running", value: "good" },
  { label: "Setup", value: "setup" },
  { label: "Downtime", value: "downtime" }
];

const DRILL_TABS = [
  {
    label: "Status Reasons",
    value: "status",
    helper: "Breaks time into the actual reasons behind loss."
  },
  {
    label: "Operators",
    value: "operator",
    helper: "Shows whether an operator or crew pattern lines up with the loss."
  },
  {
    label: "Jobs",
    value: "job",
    helper: "Compares the active job codes and where time is being spent."
  },
  {
    label: "Presses",
    value: "press",
    helper: "Ranks presses so you can see which machines are underperforming."
  },
  {
    label: "Days",
    value: "day",
    helper: "Highlights whether one day was worse or better than another."
  }
];

const QUICK_RANGES = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last7" },
  { label: "This Week", value: "thisWeek" }
];

const EMPTY_SUMMARY = {
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
  sampleCount: 0,
  latestIntervalAt: null
};

function toDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatDay(timestamp) {
  if (!timestamp) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
}

function formatHours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(1)}h`;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const offset = (day + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function getRangePreset(preset) {
  const now = new Date();

  if (preset === "yesterday") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 1);
    return { since: start, until: startOfDay(now) };
  }

  if (preset === "last7") {
    const until = new Date(now);
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    return { since, until };
  }

  if (preset === "thisWeek") {
    return { since: startOfWeek(now), until: now };
  }

  return { since: startOfDay(now), until: now };
}

function getBusinessStateLabel(state) {
  if (state === "good") {
    return "Running";
  }

  if (state === "setup") {
    return "Setup";
  }

  if (state === "downtime") {
    return "Downtime";
  }

  return "All";
}

function getBusinessStateClass(state) {
  if (state === "good") {
    return "good";
  }

  if (state === "setup") {
    return "setup";
  }

  if (state === "downtime") {
    return "downtime";
  }

  return "unknown";
}

function summarizeIntervals(intervals) {
  const totals = intervals.reduce(
    (acc, interval) => {
      if (interval.businessState === "good") {
        acc.goodMinutes += interval.minutes;
      } else if (interval.businessState === "setup") {
        acc.setupMinutes += interval.minutes;
      } else {
        acc.downtimeMinutes += interval.minutes;
      }

      return acc;
    },
    { goodMinutes: 0, setupMinutes: 0, downtimeMinutes: 0 }
  );

  const totalObservedMinutes = totals.goodMinutes + totals.setupMinutes + totals.downtimeMinutes;
  const lossBuckets = new Map();

  for (const interval of intervals) {
    if (interval.businessState === "good") {
      continue;
    }

    lossBuckets.set(
      interval.statusDescription,
      (lossBuckets.get(interval.statusDescription) || 0) + interval.minutes
    );
  }

  const biggestLossReason = Array.from(lossBuckets.entries())
    .map(([statusDescription, minutes]) => ({ statusDescription, minutes }))
    .sort((left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription))[0];

  return {
    goodMinutes: totals.goodMinutes,
    setupMinutes: totals.setupMinutes,
    downtimeMinutes: totals.downtimeMinutes,
    totalObservedMinutes,
    totalObservedHours: totalObservedMinutes / 60,
    goodPercent: totalObservedMinutes > 0 ? totals.goodMinutes / totalObservedMinutes : 0,
    setupPercent: totalObservedMinutes > 0 ? totals.setupMinutes / totalObservedMinutes : 0,
    downtimePercent: totalObservedMinutes > 0 ? totals.downtimeMinutes / totalObservedMinutes : 0,
    biggestLossReason: biggestLossReason ? biggestLossReason.statusDescription : "--",
    biggestLossMinutes: biggestLossReason ? biggestLossReason.minutes : 0,
    sampleCount: intervals.length
  };
}

function aggregateIntervals(intervals, keyFn, labelFn) {
  const buckets = new Map();

  for (const interval of intervals) {
    const key = keyFn(interval);
    if (key === null || key === undefined || key === "") {
      continue;
    }

    const bucket = buckets.get(key) || {
      key,
      label: labelFn ? labelFn(interval, key) : String(key),
      sampleCount: 0,
      goodMinutes: 0,
      setupMinutes: 0,
      downtimeMinutes: 0,
      totalMinutes: 0,
      topLossReason: "--",
      topLossMinutes: 0,
      statusBuckets: new Map()
    };

    bucket.sampleCount += 1;
    bucket.totalMinutes += interval.minutes;

    if (interval.businessState === "good") {
      bucket.goodMinutes += interval.minutes;
    } else if (interval.businessState === "setup") {
      bucket.setupMinutes += interval.minutes;
    } else {
      bucket.downtimeMinutes += interval.minutes;
    }

    const statusKey = interval.statusDescription || "Unknown";
    bucket.statusBuckets.set(statusKey, (bucket.statusBuckets.get(statusKey) || 0) + interval.minutes);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const statusRows = Array.from(bucket.statusBuckets.entries())
        .map(([statusDescription, minutes]) => ({ statusDescription, minutes }))
        .sort((left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription));

      const topLoss = statusRows.find((row) => row.statusDescription !== "Run Production") || statusRows[0] || null;
      const totalMinutes = bucket.totalMinutes;

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
        topLossReason: topLoss ? topLoss.statusDescription : "--",
        topLossMinutes: topLoss ? topLoss.minutes : 0,
        statusRows
      };
    })
    .sort((left, right) => right.totalMinutes - left.totalMinutes || String(left.label).localeCompare(String(right.label)));
}

function getDeltaLabel(currentValue, previousValue, kind = "percent") {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }

  if (kind === "hours") {
    const delta = currentValue - previousValue;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}h`;
  }

  if (kind === "minutes") {
    const delta = currentValue - previousValue;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.round(delta)}m`;
  }

  const delta = (currentValue - previousValue) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} pp`;
}

function formatRangeLabel(since, until) {
  if (!since || !until) {
    return "--";
  }

  return `${formatTimestamp(since)} to ${formatTimestamp(until)}`;
}

function formatRangeChipLabel(since, until) {
  if (!since || !until) {
    return "Today";
  }

  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) {
    return "Today";
  }

  const sameDay =
    sinceDate.getFullYear() === untilDate.getFullYear() &&
    sinceDate.getMonth() === untilDate.getMonth() &&
    sinceDate.getDate() === untilDate.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(sinceDate);
  }

  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(sinceDate)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(untilDate)}`;
}

function compareRange(range) {
  if (!range?.since || !range?.until) {
    return null;
  }

  const since = new Date(range.since);
  const until = new Date(range.until);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since) {
    return null;
  }

  const durationMs = until.getTime() - since.getTime();
  return {
    since: new Date(since.getTime() - durationMs).toISOString(),
    until: since.toISOString()
  };
}

function buildFocusRecommendation(intervals) {
  const lossIntervals = intervals.filter((interval) => interval.businessState !== "good");

  if (lossIntervals.length === 0) {
    return {
      hasRecommendation: false,
      severity: "neutral",
      title: "No major loss found for this range.",
      sentence: "No major loss found for this range.",
      stateLabel: "None",
      lostMinutes: 0,
      topReason: "--",
      mainPress: null,
      mainOperator: null,
      mainJob: null,
      statusDescription: null,
      businessState: "all"
    };
  }

  const setupMinutes = lossIntervals
    .filter((interval) => interval.businessState === "setup")
    .reduce((acc, interval) => acc + interval.minutes, 0);
  const downtimeMinutes = lossIntervals
    .filter((interval) => interval.businessState === "downtime")
    .reduce((acc, interval) => acc + interval.minutes, 0);

  const difference = Math.abs(downtimeMinutes - setupMinutes);
  const downtimePreferred = downtimeMinutes > setupMinutes || difference <= 5 || (setupMinutes > 0 && difference / setupMinutes <= 0.1);
  const businessState = downtimePreferred ? "downtime" : "setup";
  const severity = businessState === "downtime" ? "downtime" : "setup";
  const stateLabel = businessState === "downtime" ? "Downtime Loss" : "Setup Loss";
  const bucketRows = lossIntervals.filter((interval) => interval.businessState === businessState);
  const topReasonRow = bucketRows
    .reduce((acc, interval) => {
      const next = acc.get(interval.statusDescription) || 0;
      acc.set(interval.statusDescription, next + interval.minutes);
      return acc;
    }, new Map());
  const topReason = Array.from(topReasonRow.entries())
    .map(([statusDescription, minutes]) => ({ statusDescription, minutes }))
    .sort((left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription))[0];

  const pressBucket = bucketRows.reduce((acc, interval) => {
    acc.set(interval.machineId, (acc.get(interval.machineId) || 0) + interval.minutes);
    return acc;
  }, new Map());
  const operatorBucket = bucketRows.reduce((acc, interval) => {
    acc.set(interval.operationCode, (acc.get(interval.operationCode) || 0) + interval.minutes);
    return acc;
  }, new Map());
  const jobBucket = bucketRows.reduce((acc, interval) => {
    acc.set(interval.jobCode, (acc.get(interval.jobCode) || 0) + interval.minutes);
    return acc;
  }, new Map());

  const mainPress = Array.from(pressBucket.entries())
    .map(([machineId, minutes]) => ({ machineId, minutes }))
    .sort((left, right) => right.minutes - left.minutes || left.machineId.localeCompare(right.machineId))[0] || null;
  const mainOperator = Array.from(operatorBucket.entries())
    .map(([operationCode, minutes]) => ({ operationCode, minutes }))
    .sort((left, right) => right.minutes - left.minutes || left.operationCode.localeCompare(right.operationCode))[0] || null;
  const mainJob = Array.from(jobBucket.entries())
    .map(([jobCode, minutes]) => ({ jobCode, minutes }))
    .sort((left, right) => right.minutes - left.minutes || left.jobCode.localeCompare(right.jobCode))[0] || null;

  const pressName = mainPress ? formatMachineDisplayName(mainPress.machineId) : "this selection";
  const reasonName = topReason ? topReason.statusDescription : "the top loss reason";
  const jobName = mainJob?.jobCode || "an unknown job";

  return {
    hasRecommendation: true,
    severity,
    title: stateLabel,
    sentence:
      businessState === "downtime"
        ? `Focus next on ${pressName} downtime losses. ${reasonName} caused ${formatDurationMinutes(topReason?.minutes || 0)} of lost time, mostly on job ${jobName}.`
        : `Focus next on ${pressName} setup losses. ${reasonName} caused ${formatDurationMinutes(topReason?.minutes || 0)} of lost time, mostly on job ${jobName}.`,
    stateLabel,
    lostMinutes: businessState === "downtime" ? downtimeMinutes : setupMinutes,
    topReason: reasonName,
    mainPress,
    mainOperator,
    mainJob,
    statusDescription: topReason?.statusDescription || null,
    businessState
  };
}

function buildIntervalAnalysis(intervals) {
  const pressBuckets = new Map();
  const dayBuckets = new Map();
  const statusBuckets = new Map();
  const operatorBuckets = new Map();
  const jobBuckets = new Map();

  const totals = {
    goodMinutes: 0,
    setupMinutes: 0,
    downtimeMinutes: 0
  };

  for (const interval of intervals) {
    const bucketKey = interval.machineId;
    const dayKey = interval.dayKey;
    const statusKey = interval.statusDescription || "Unknown";
    const operatorKey = interval.operationCode || "Unknown Operator";
    const jobKey = interval.jobCode || "Non Productive / Unknown Job";

    if (interval.businessState === "good") {
      totals.goodMinutes += interval.minutes;
    } else if (interval.businessState === "setup") {
      totals.setupMinutes += interval.minutes;
    } else {
      totals.downtimeMinutes += interval.minutes;
    }

    function touchBucket(map, key, label) {
      if (key === null || key === undefined || key === "") {
        return null;
      }

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          sampleCount: 0,
          goodMinutes: 0,
          setupMinutes: 0,
          downtimeMinutes: 0,
          totalMinutes: 0,
          statusBuckets: new Map()
        });
      }

      const bucket = map.get(key);
      bucket.sampleCount += 1;
      bucket.totalMinutes += interval.minutes;

      if (interval.businessState === "good") {
        bucket.goodMinutes += interval.minutes;
      } else if (interval.businessState === "setup") {
        bucket.setupMinutes += interval.minutes;
      } else {
        bucket.downtimeMinutes += interval.minutes;
      }

      bucket.statusBuckets.set(statusKey, (bucket.statusBuckets.get(statusKey) || 0) + interval.minutes);
      return bucket;
    }

    touchBucket(pressBuckets, bucketKey, formatMachineDisplayName(bucketKey));
    touchBucket(dayBuckets, dayKey, dayKey);
    touchBucket(statusBuckets, statusKey, statusKey);
    touchBucket(operatorBuckets, operatorKey, operatorKey);
    touchBucket(jobBuckets, jobKey, jobKey);
  }

  function finalizeBuckets(map, kind) {
    return Array.from(map.values())
      .map((bucket) => {
        const statusRows = Array.from(bucket.statusBuckets.entries())
          .map(([statusDescription, minutes]) => ({ statusDescription, minutes }))
          .sort((left, right) => right.minutes - left.minutes || left.statusDescription.localeCompare(right.statusDescription));

        const topLoss = statusRows.find((row) => row.statusDescription !== "Run Production") || statusRows[0] || null;
        const totalMinutes = bucket.totalMinutes;

        return {
          key: bucket.key,
          label:
            kind === "press"
              ? formatMachineDisplayName(bucket.key)
              : kind === "day"
                ? formatDay(bucket.key)
                : bucket.label,
          sampleCount: bucket.sampleCount,
          sampleHours: bucket.sampleCount / 60,
          goodMinutes: bucket.goodMinutes,
          setupMinutes: bucket.setupMinutes,
          downtimeMinutes: bucket.downtimeMinutes,
          totalMinutes,
          goodPercent: totalMinutes > 0 ? bucket.goodMinutes / totalMinutes : 0,
          setupPercent: totalMinutes > 0 ? bucket.setupMinutes / totalMinutes : 0,
          downtimePercent: totalMinutes > 0 ? bucket.downtimeMinutes / totalMinutes : 0,
          topLossReason: topLoss ? topLoss.statusDescription : "--",
          topLossMinutes: topLoss ? topLoss.minutes : 0,
          statusRows
        };
      })
      .sort((left, right) => right.totalMinutes - left.totalMinutes || String(left.label).localeCompare(String(right.label)));
  }

  const summaryTotals = totals.goodMinutes + totals.setupMinutes + totals.downtimeMinutes;
  const summaryLossRows = finalizeBuckets(statusBuckets, "status").filter((row) => row.key !== "Run Production");
  const biggestLossReason = summaryLossRows[0] || null;

  return {
    summary: {
      goodMinutes: totals.goodMinutes,
      setupMinutes: totals.setupMinutes,
      downtimeMinutes: totals.downtimeMinutes,
      totalObservedMinutes: summaryTotals,
      totalObservedHours: summaryTotals / 60,
      goodPercent: summaryTotals > 0 ? totals.goodMinutes / summaryTotals : 0,
      setupPercent: summaryTotals > 0 ? totals.setupMinutes / summaryTotals : 0,
      downtimePercent: summaryTotals > 0 ? totals.downtimeMinutes / summaryTotals : 0,
      biggestLossReason: biggestLossReason ? biggestLossReason.label : "--",
      biggestLossMinutes: biggestLossReason ? biggestLossReason.totalMinutes : 0,
      sampleCount: intervals.length
    },
    pressRows: finalizeBuckets(pressBuckets, "press"),
    dayRows: finalizeBuckets(dayBuckets, "day"),
    statusRows: finalizeBuckets(statusBuckets, "status"),
    operatorRows: finalizeBuckets(operatorBuckets, "operator"),
    jobRows: finalizeBuckets(jobBuckets, "job")
  };
}

function matchesFilters(interval, filters) {
  if (filters.businessState !== "all" && interval.businessState !== filters.businessState) {
    return false;
  }

  if (filters.eventType !== "all" && interval.eventType !== filters.eventType) {
    return false;
  }

  if (filters.statusDescription !== "all" && interval.statusDescription !== filters.statusDescription) {
    return false;
  }

  if (filters.operationCode !== "all" && interval.operationCode !== filters.operationCode) {
    return false;
  }

  if (filters.jobCode !== "all" && interval.jobCode !== filters.jobCode) {
    return false;
  }

  return true;
}

function percentageWidth(minutes, totalMinutes) {
  if (!totalMinutes) {
    return "0%";
  }

  return `${Math.max(4, (minutes / totalMinutes) * 100)}%`;
}

function KpiCard({ label, value, subtitle, change, tone, active, onClick }) {
  const classes = [
    "kpi-card",
    tone ? `kpi-card-${tone}` : "",
    active ? "kpi-card-active" : "",
    onClick ? "kpi-card-clickable" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} onClick={onClick}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-subtitle">{subtitle}</span>
      {change ? <span className={`kpi-change ${change.direction}`}>{change.label}</span> : null}
    </button>
  );
}

function StateChip({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      className={active ? "state-chip state-chip-active" : "state-chip"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SectionHeader({ eyebrow, title, helper, meta }) {
  return (
    <div className="analysis-section-header">
      <div>
        <p className="analysis-eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        {helper ? <p className="analysis-helper">{helper}</p> : null}
      </div>
      {meta ? <div className="analysis-section-meta">{meta}</div> : null}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="analysis-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function SkeletonBlock() {
  return <div className="skeleton-block" />;
}

function LoadingSkeleton() {
  return (
    <section className="analysis-loading-grid">
      <div className="panel status-analysis-panel">
        <SkeletonBlock />
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
      <div className="panel status-analysis-panel">
        <SkeletonBlock />
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
    </section>
  );
}

function PercentCell({ value, totalMinutes, tone }) {
  return (
    <div className="percent-cell">
      <div className="percent-cell-top">
        <strong>{formatPercent(value, totalMinutes)}</strong>
        <span>{formatDurationMinutes(value)}</span>
      </div>
      <div className="percent-meter">
        <span className={`percent-fill percent-fill-${tone}`} style={{ width: percentageWidth(value, totalMinutes) }} />
      </div>
    </div>
  );
}

function MetricTable({ rows, sortKey, onSortChange, columns, emptyLabel, highlightKey, kind = "comparison" }) {
  if (!rows.length) {
    return <EmptyState title="No data for selected range" description={emptyLabel} />;
  }

  return (
    <div className="table-shell">
      <table className="comparison-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? "align-right" : ""}>
                {column.sortable ? (
                  <button
                    type="button"
                    className="table-sort-button"
                    onClick={() => onSortChange(column.key)}
                  >
                    <span>{column.label}</span>
                    <span className="sort-arrow">
                      {sortKey.key === column.key ? (sortKey.direction === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={highlightKey && row.key === highlightKey ? "comparison-row-highlight" : ""}>
              <td>
                <div className="comparison-primary">
                  <strong>{row.label}</strong>
                  <span>
                    {row.sampleCount} samples · {formatHours(row.totalMinutes)}
                  </span>
                </div>
              </td>
              <td className="align-right"><PercentCell value={row.goodMinutes} totalMinutes={row.totalMinutes} tone="good" /></td>
              <td className="align-right"><PercentCell value={row.setupMinutes} totalMinutes={row.totalMinutes} tone="setup" /></td>
              <td className="align-right"><PercentCell value={row.downtimeMinutes} totalMinutes={row.totalMinutes} tone="downtime" /></td>
              <td className="align-right">{formatHours(row.totalMinutes)}</td>
              <td>
                <div className="comparison-loss">
                  <strong>{row.topLossReason}</strong>
                  <span>{formatPercent(row.topLossMinutes, row.totalMinutes)}</span>
                </div>
              </td>
              <td className="align-right">{formatDurationMinutes(row.topLossMinutes)}</td>
              <td>
                <div className="mix-bar" aria-hidden="true">
                  <span className="mix-bar-good" style={{ width: percentageWidth(row.goodMinutes, row.totalMinutes) }} />
                  <span className="mix-bar-setup" style={{ width: percentageWidth(row.setupMinutes, row.totalMinutes) }} />
                  <span className="mix-bar-downtime" style={{ width: percentageWidth(row.downtimeMinutes, row.totalMinutes) }} />
                </div>
              </td>
              {kind === "drilldown" ? <td className="align-right">{row.sampleCount}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ intervals, selectedStatusDescription, selectedBusinessState, onSelectSegment }) {
  if (!intervals.length) {
    return (
      <EmptyState
        title="No timeline data"
        description="The selected press has no data in the chosen range."
      />
    );
  }

  return (
    <div className="timeline-track">
      {intervals.map((interval) => {
        const stateClass = interval.businessState || "unknown";
        const isSelected = selectedStatusDescription === interval.statusDescription;
        const isMuted = selectedBusinessState !== "all" && selectedBusinessState !== interval.businessState;

        return (
          <button
            key={`${interval.machineId}-${interval.startAt}-${interval.endAt}`}
            type="button"
            className={[
              "timeline-segment",
              `timeline-segment-${stateClass}`,
              isSelected ? "timeline-segment-selected" : "",
              isMuted ? "timeline-segment-muted" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              flexGrow: Math.max(interval.minutes, 1),
              minWidth: `${Math.max(8, interval.minutes * 6)}px`
            }}
            onClick={() => onSelectSegment(interval)}
            title={[
              interval.pressLabel,
              `${formatTimestamp(interval.startAt)} - ${formatTimestamp(interval.endAt)}`,
              interval.eventType || "Unknown event",
              interval.statusDescription,
              formatDurationMinutes(interval.minutes),
              `Operator: ${interval.operationCode || "Unknown Operator"}`,
              `Job: ${interval.jobCode || "Non Productive / Unknown Job"}`
            ].join(" | ")}
          >
          </button>
        );
      })}
    </div>
  );
}

function DebugPanel({ currentDebug, previousDebug }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel status-analysis-panel developer-debug-panel">
      <button type="button" className="debug-toggle-button" onClick={() => setOpen((current) => !current)}>
        <span>Developer Debug</span>
        <strong>{open ? "Hide" : "Show"}</strong>
      </button>
      {open ? (
        <div className="debug-grid">
          <pre className="debug-pre">{JSON.stringify(currentDebug, null, 2)}</pre>
          <pre className="debug-pre">{JSON.stringify(previousDebug, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

function FocusNextCard({ recommendation, onDrillInto }) {
  if (!recommendation?.hasRecommendation) {
    return (
      <section className="panel status-analysis-panel focus-next-card focus-next-card-neutral">
        <SectionHeader
          eyebrow="Focus next"
          title="No major loss found for this range."
          helper="The selected range is mostly clean, so there is no clear next investigation target."
        />
      </section>
    );
  }

  return (
    <section className={`panel status-analysis-panel focus-next-card focus-next-card-${recommendation.severity}`}>
      <SectionHeader
        eyebrow="Focus next"
        title="One clear next action"
        helper="Use this as the first place to inspect before widening the search."
        meta={<span>{recommendation.stateLabel}</span>}
      />

      <div className="focus-next-body">
        <div className="focus-next-copy">
          <div className="focus-next-severity-row">
            <span className={`focus-next-severity-chip focus-next-severity-chip-${recommendation.severity}`}>
              {recommendation.stateLabel}
            </span>
            <span className="focus-next-minute-chip">{formatDurationMinutes(recommendation.lostMinutes)} lost</span>
          </div>
          <p className="focus-next-sentence">{recommendation.sentence}</p>
        </div>

        <div className="focus-next-grid">
          <div className="focus-next-metric">
            <span>Lost Minutes</span>
            <strong>{formatDurationMinutes(recommendation.lostMinutes)}</strong>
          </div>
          <div className="focus-next-metric">
            <span>State</span>
            <strong>{recommendation.stateLabel}</strong>
          </div>
          <div className="focus-next-metric">
            <span>Top Reason</span>
            <strong>{recommendation.topReason}</strong>
          </div>
          <div className="focus-next-metric">
            <span>Main Press</span>
            <strong>{recommendation.mainPress ? formatMachineDisplayName(recommendation.mainPress.machineId) : "--"}</strong>
          </div>
          <div className="focus-next-metric">
            <span>Main Operator</span>
            <strong>{recommendation.mainOperator?.operationCode || "--"}</strong>
          </div>
          <div className="focus-next-metric">
            <span>Main Job</span>
            <strong>{recommendation.mainJob?.jobCode || "--"}</strong>
          </div>
        </div>

        <div className="focus-next-actions">
          <button
            type="button"
            className="analysis-chip analysis-chip-primary"
            onClick={() => onDrillInto(recommendation)}
          >
            Drill Into This
          </button>
        </div>
      </div>
    </section>
  );
}

export function AnalysisPage() {
  const now = new Date();
  const todayStart = startOfDay(now);

  const [draftSince, setDraftSince] = useState(() => toDateTimeLocalValue(todayStart));
  const [draftUntil, setDraftUntil] = useState(() => toDateTimeLocalValue(now));
  const [appliedRange, setAppliedRange] = useState({
    since: todayStart.toISOString(),
    until: now.toISOString()
  });
  const [selectedMachineIds, setSelectedMachineIds] = useState(["205"]);
  const [primaryMachineId, setPrimaryMachineId] = useState("205");
  const [businessStateFilter, setBusinessStateFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [statusDescriptionFilter, setStatusDescriptionFilter] = useState("all");
  const [operationCodeFilter, setOperationCodeFilter] = useState("all");
  const [jobCodeFilter, setJobCodeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("status");
  const [pressToAdd, setPressToAdd] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparisonSort, setComparisonSort] = useState({ key: "goodPercent", direction: "asc" });
  const [daySort, setDaySort] = useState({ key: "totalMinutes", direction: "desc" });
  const [drillSort, setDrillSort] = useState({ key: "totalMinutes", direction: "desc" });
  const { setHeaderState, defaultHeaderState } = usePageHeader();

  useEffect(() => {
    setHeaderState({
      eyebrow: "Industrial Analysis",
      title: "Press Loss Investigation",
      detailLabel: "Range",
      detailValue: "Today"
    });

    return () => {
      setHeaderState(defaultHeaderState);
    };
  }, [defaultHeaderState, setHeaderState]);

  const currentParams = useMemo(
    () => ({
      since: appliedRange.since,
      until: appliedRange.until,
      machineIds: selectedMachineIds,
      refreshNonce
    }),
    [appliedRange.since, appliedRange.until, selectedMachineIds, refreshNonce]
  );

  const previousRange = useMemo(() => compareRange(appliedRange), [appliedRange]);

  const previousParams = useMemo(
    () => ({
      since: previousRange?.since,
      until: previousRange?.until,
      machineIds: selectedMachineIds,
      refreshNonce,
      enabled: compareEnabled
    }),
    [previousRange?.since, previousRange?.until, selectedMachineIds, refreshNonce, compareEnabled]
  );

  const analysis = useMachineStatusAnalysis(currentParams);
  const previousAnalysis = useMachineStatusAnalysis(previousParams);

  const availableMachines = analysis.availableMachines.length > 0 ? analysis.availableMachines : analysis.filter_options.machineIds;
  const currentIntervals = analysis.intervals || [];
  const comparisonIntervals = previousAnalysis.intervals || [];
  const canCompare = Boolean(compareEnabled && previousRange?.since && previousRange?.until && comparisonIntervals.length > 0);
  const filteredIntervals = useMemo(
    () =>
      currentIntervals.filter((interval) =>
        matchesFilters(interval, {
          businessState: businessStateFilter,
          eventType: eventTypeFilter,
          statusDescription: statusDescriptionFilter,
          operationCode: operationCodeFilter,
          jobCode: jobCodeFilter
        })
      ),
    [currentIntervals, businessStateFilter, eventTypeFilter, statusDescriptionFilter, operationCodeFilter, jobCodeFilter]
  );
  const currentAnalysis = useMemo(() => buildIntervalAnalysis(currentIntervals), [currentIntervals]);
  const filteredAnalysis = useMemo(() => buildIntervalAnalysis(filteredIntervals), [filteredIntervals]);
  const previousAnalysisSummary = useMemo(() => buildIntervalAnalysis(comparisonIntervals), [comparisonIntervals]);

  useEffect(() => {
    if (availableMachines.length === 0) {
      return;
    }

    setSelectedMachineIds((current) => {
      const filtered = current.filter((machineId) => availableMachines.includes(machineId));
      if (filtered.length > 0) {
        return filtered;
      }

      return availableMachines.includes("205") ? ["205"] : [availableMachines[0]];
    });

    setPrimaryMachineId((current) => {
      if (availableMachines.includes(current)) {
        return current;
      }

      return availableMachines.includes("205") ? "205" : availableMachines[0];
    });
  }, [availableMachines]);

  const selectedMachineCount = selectedMachineIds.length;

  const selectedMachineOptions = useMemo(
    () => availableMachines.filter((machineId) => !selectedMachineIds.includes(machineId)),
    [availableMachines, selectedMachineIds]
  );

  const currentSummary = currentAnalysis.summary;
  const previousSummary = previousAnalysisSummary.summary;

  const timelineIntervals = useMemo(
    () =>
      currentIntervals
        .filter((interval) => interval.machineId === primaryMachineId)
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
    [currentIntervals, primaryMachineId]
  );

  const drilldownIntervals = filteredIntervals;
  const focusRecommendation = useMemo(
    () => buildFocusRecommendation(currentIntervals),
    [currentIntervals]
  );

  const lossIntervals = useMemo(() => {
    if (businessStateFilter === "all") {
      return drilldownIntervals.filter((interval) => interval.businessState !== "good");
    }

    return drilldownIntervals.filter((interval) => interval.businessState === businessStateFilter);
  }, [drilldownIntervals, businessStateFilter]);

  const lossRows = useMemo(
    () => buildIntervalAnalysis(lossIntervals).statusRows.filter((row) => row.key !== "Run Production"),
    [lossIntervals]
  );
  const focusedLossTotalMinutes = useMemo(
    () => drilldownIntervals.reduce((acc, interval) => acc + interval.minutes, 0),
    [drilldownIntervals]
  );

  const pressRows = currentAnalysis.pressRows;
  const dayRows = currentAnalysis.dayRows;
  const activeDrillRows = useMemo(() => {
    const source =
      activeTab === "status"
        ? filteredAnalysis.statusRows
        : activeTab === "operator"
          ? filteredAnalysis.operatorRows
          : activeTab === "job"
            ? filteredAnalysis.jobRows
            : activeTab === "press"
              ? filteredAnalysis.pressRows
              : filteredAnalysis.dayRows;

    return source.map((row) => ({
      ...row,
      label:
        activeTab === "press"
          ? formatMachineDisplayName(row.key)
          : activeTab === "day"
            ? formatDay(row.key)
            : row.label || row.key
    }));
  }, [activeTab, filteredAnalysis]);

  const sortedComparisonRows = useMemo(() => {
    const rows = [...pressRows].sort((left, right) => left.goodPercent - right.goodPercent || right.totalMinutes - left.totalMinutes);

    if (comparisonSort.key !== "goodPercent") {
      rows.sort((left, right) => {
        const leftValue = left[comparisonSort.key];
        const rightValue = right[comparisonSort.key];
        const leftComparable = typeof leftValue === "string" ? leftValue : Number(leftValue || 0);
        const rightComparable = typeof rightValue === "string" ? rightValue : Number(rightValue || 0);

        if (leftComparable < rightComparable) {
          return comparisonSort.direction === "asc" ? -1 : 1;
        }

        if (leftComparable > rightComparable) {
          return comparisonSort.direction === "asc" ? 1 : -1;
        }

        return left.goodPercent - right.goodPercent || right.totalMinutes - left.totalMinutes;
      });
    } else if (comparisonSort.direction === "desc") {
      rows.reverse();
    }

    return rows.map((row) => ({
      ...row,
      label: formatMachineDisplayName(row.key)
    }));
  }, [pressRows, comparisonSort]);

  const sortedDrillRows = useMemo(() => {
    const rows = [...activeDrillRows];
    rows.sort((left, right) => {
      const leftValue = left[drillSort.key];
      const rightValue = right[drillSort.key];

      const leftComparable =
        typeof leftValue === "string" ? leftValue.toLowerCase() : Number(leftValue || 0);
      const rightComparable =
        typeof rightValue === "string" ? rightValue.toLowerCase() : Number(rightValue || 0);

      if (leftComparable < rightComparable) {
        return drillSort.direction === "asc" ? -1 : 1;
      }

      if (leftComparable > rightComparable) {
        return drillSort.direction === "asc" ? 1 : -1;
      }

      return right.totalMinutes - left.totalMinutes;
    });

    return rows;
  }, [activeDrillRows, drillSort]);

  const worstPress = sortedComparisonRows[0] || null;
  const bestPress = sortedComparisonRows[sortedComparisonRows.length - 1] || null;
  const biggestLoss = lossRows[0] || null;

  function applyPreset(preset) {
    const nextRange = getRangePreset(preset);
    setDraftSince(toDateTimeLocalValue(nextRange.since));
    setDraftUntil(toDateTimeLocalValue(nextRange.until));
    setAppliedRange({
      since: nextRange.since.toISOString(),
      until: nextRange.until.toISOString()
    });
  }

  function handleApplyRange() {
    const since = fromDateTimeLocalValue(draftSince);
    const until = fromDateTimeLocalValue(draftUntil);

    if (!since || !until) {
      return;
    }

    setAppliedRange({ since, until });
  }

  function handleClearFilters() {
    const nextRange = getRangePreset("today");
    setDraftSince(toDateTimeLocalValue(nextRange.since));
    setDraftUntil(toDateTimeLocalValue(nextRange.until));
    setAppliedRange({
      since: nextRange.since.toISOString(),
      until: nextRange.until.toISOString()
    });
    setSelectedMachineIds(["205"]);
    setPrimaryMachineId("205");
    setBusinessStateFilter("all");
    setEventTypeFilter("all");
    setStatusDescriptionFilter("all");
    setOperationCodeFilter("all");
    setJobCodeFilter("all");
    setActiveTab("status");
    setPressToAdd("");
    setCompareEnabled(false);
  }

  function handleRefresh() {
    setRefreshNonce((current) => current + 1);
  }

  function toggleMachine(machineId) {
    setSelectedMachineIds((current) => {
      const exists = current.includes(machineId);
      const next = exists ? current.filter((value) => value !== machineId) : [...current, machineId];

      if (next.length === 0) {
        return current;
      }

      if (!next.includes(primaryMachineId)) {
        setPrimaryMachineId(next[0]);
      }

      return next;
    });
  }

  function addMachine(machineId) {
    if (!machineId || selectedMachineIds.includes(machineId)) {
      return;
    }

    setSelectedMachineIds((current) => [...current, machineId]);
    setPrimaryMachineId((current) => (current && selectedMachineIds.includes(current) ? current : machineId));
    setPressToAdd("");
  }

  function removeMachine(machineId) {
    setSelectedMachineIds((current) => {
      const next = current.filter((value) => value !== machineId);

      if (next.length === 0) {
        return ["205"];
      }

      if (machineId === primaryMachineId) {
        setPrimaryMachineId(next[0]);
      }

      return next;
    });
  }

  function resetRangeToToday() {
    const nextRange = getRangePreset("today");
    setDraftSince(toDateTimeLocalValue(nextRange.since));
    setDraftUntil(toDateTimeLocalValue(nextRange.until));
    setAppliedRange({
      since: nextRange.since.toISOString(),
      until: nextRange.until.toISOString()
    });
  }

  function sortRows(key, currentSort, setSort) {
    setSort((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc"
        };
      }

      return {
        key,
        direction:
          key === "label" || key === "topLossReason" ? "asc" : "desc"
      };
    });
  }

  function selectTimelineInterval(interval) {
    setBusinessStateFilter(interval.businessState);
    setStatusDescriptionFilter("all");
    setEventTypeFilter(interval.eventType || "all");
    setOperationCodeFilter("all");
    setJobCodeFilter("all");
    setActiveTab("status");
  }

  function setFocusState(state) {
    setBusinessStateFilter(state);
    setActiveTab("status");
  }

  function focusPress(machineId) {
    setPrimaryMachineId(machineId);
    setActiveTab("press");
  }

  function drillIntoRecommendation(recommendation) {
    if (!recommendation?.hasRecommendation) {
      return;
    }

    setBusinessStateFilter(recommendation.businessState);
    setStatusDescriptionFilter(recommendation.statusDescription || "all");
    setOperationCodeFilter(recommendation.mainOperator?.operationCode || "all");
    setJobCodeFilter(recommendation.mainJob?.jobCode || "all");

    if (recommendation.mainPress?.machineId) {
      setSelectedMachineIds((current) => {
        if (current.includes(recommendation.mainPress.machineId)) {
          return current;
        }

        return [...current, recommendation.mainPress.machineId];
      });
      setPrimaryMachineId(recommendation.mainPress.machineId);
    }

    setActiveTab("status");
  }

  const kpiChange = canCompare
    ? {
        good: getDeltaLabel(currentSummary.goodPercent, previousSummary.goodPercent, "percent"),
        setup: getDeltaLabel(currentSummary.setupPercent, previousSummary.setupPercent, "percent"),
        downtime: getDeltaLabel(currentSummary.downtimePercent, previousSummary.downtimePercent, "percent"),
        hours: getDeltaLabel(currentSummary.totalObservedHours, previousSummary.totalObservedHours, "hours")
      }
    : null;

  const isLoading = analysis.isLoading && currentIntervals.length === 0;
  const rangeChipLabel = formatRangeChipLabel(appliedRange.since, appliedRange.until);

  return (
    <section className="status-analysis-page">
      <section className="panel analysis-toolbar">
        <div className="analysis-toolbar-top">
          <div>
            <p className="analysis-eyebrow">Industrial analysis</p>
            <h3>Where did we lose press time, and why?</h3>
            <p className="analysis-helper">
              Built from `machine_status_history` with durations estimated from consecutive polls.
            </p>
          </div>
          <div className="analysis-toolbar-meta">
            <span>Last refreshed</span>
            <strong>{analysis.lastLoadedLabel}</strong>
            <small>{formatRangeLabel(analysis.since, analysis.until)}</small>
          </div>
        </div>

        <div className="analysis-toolbar-grid">
          <div className="analysis-toolbar-card">
            <div className="analysis-toolbar-card-head">
              <p className="analysis-eyebrow">Date range</p>
              <div className="analysis-toolbar-actions">
                <button type="button" className="analysis-text-button" onClick={() => setCompareEnabled((current) => !current)}>
                  {compareEnabled ? "Hide compare" : "Compare previous"}
                </button>
                <button type="button" className="analysis-text-button" onClick={handleRefresh}>
                  Refresh
                </button>
              </div>
            </div>
            <div className="analysis-date-grid">
              <label className="analysis-field">
                <span>From</span>
                <input
                  type="datetime-local"
                  className="analysis-input"
                  value={draftSince}
                  onChange={(event) => setDraftSince(event.target.value)}
                />
              </label>
              <label className="analysis-field">
                <span>To</span>
                <input
                  type="datetime-local"
                  className="analysis-input"
                  value={draftUntil}
                  onChange={(event) => setDraftUntil(event.target.value)}
                />
              </label>
            </div>
            <div className="analysis-quick-ranges">
              {QUICK_RANGES.map((preset) => (
                <button key={preset.value} type="button" className="analysis-chip" onClick={() => applyPreset(preset.value)}>
                  {preset.label}
                </button>
              ))}
              <button type="button" className="analysis-chip analysis-chip-primary" onClick={handleApplyRange}>
                Apply Range
              </button>
            </div>
          </div>

          <div className="analysis-toolbar-card">
            <div className="analysis-toolbar-card-head">
              <p className="analysis-eyebrow">Selected filters</p>
              <button type="button" className="analysis-text-button" onClick={handleClearFilters}>
                Clear filters
              </button>
            </div>
            <div className="analysis-selection-chips">
              <div className="analysis-filter-chip analysis-filter-chip-range">
                <button type="button" className="analysis-filter-chip-body" onClick={handleApplyRange} title="Use the current date range">
                  <strong>{rangeChipLabel}</strong>
                  <span>Date range</span>
                </button>
                <button type="button" className="analysis-filter-chip-close" onClick={resetRangeToToday} title="Reset to today">
                  ×
                </button>
              </div>

              {selectedMachineIds.map((machineId) => (
                <div
                  key={machineId}
                  className={`analysis-filter-chip ${primaryMachineId === machineId ? "analysis-filter-chip-primary" : ""}`}
                >
                  <button type="button" className="analysis-filter-chip-body" onClick={() => focusPress(machineId)} title="Focus this press">
                    <strong>{formatMachineDisplayName(machineId)}</strong>
                    <span>{machineId}</span>
                  </button>
                  <button
                    type="button"
                    className="analysis-filter-chip-close"
                    onClick={() => removeMachine(machineId)}
                    title="Remove press"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="analysis-add-press-row">
              <label className="analysis-field">
                <span>Add Press</span>
                <select
                  className="analysis-input"
                  value={pressToAdd}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPressToAdd(value);
                    if (value) {
                      addMachine(value);
                    }
                  }}
                  disabled={selectedMachineOptions.length === 0}
                >
                  <option value="">Choose a press</option>
                  {selectedMachineOptions.map((machineId) => (
                    <option key={machineId} value={machineId}>
                      {formatMachineDisplayName(machineId)} ({machineId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="analysis-field">
                <span>Business state</span>
                <div className="analysis-state-chips">
                  {BUSINESS_STATE_OPTIONS.map((option) => (
                    <StateChip
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      active={businessStateFilter === option.value}
                      onClick={() => setFocusState(option.value)}
                    />
                  ))}
                </div>
              </label>
            </div>
            <p className="analysis-panel-note">{selectedMachineCount} presses selected</p>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard
          label="Good Time %"
          value={formatPercent(currentSummary.goodMinutes, currentSummary.totalObservedMinutes)}
          subtitle={formatDurationMinutes(currentSummary.goodMinutes)}
          change={kpiChange?.good ? { label: `vs previous ${kpiChange.good}`, direction: currentSummary.goodPercent >= previousSummary.goodPercent ? "positive" : "negative" } : null}
          tone="good"
          active={businessStateFilter === "good"}
          onClick={() => setFocusState("good")}
        />
        <KpiCard
          label="Setup Time %"
          value={formatPercent(currentSummary.setupMinutes, currentSummary.totalObservedMinutes)}
          subtitle={formatDurationMinutes(currentSummary.setupMinutes)}
          change={kpiChange?.setup ? { label: `vs previous ${kpiChange.setup}`, direction: currentSummary.setupPercent <= previousSummary.setupPercent ? "positive" : "negative" } : null}
          tone="setup"
          active={businessStateFilter === "setup"}
          onClick={() => setFocusState("setup")}
        />
        <KpiCard
          label="Downtime %"
          value={formatPercent(currentSummary.downtimeMinutes, currentSummary.totalObservedMinutes)}
          subtitle={formatDurationMinutes(currentSummary.downtimeMinutes)}
          change={kpiChange?.downtime ? { label: `vs previous ${kpiChange.downtime}`, direction: currentSummary.downtimePercent <= previousSummary.downtimePercent ? "positive" : "negative" } : null}
          tone="downtime"
          active={businessStateFilter === "downtime"}
          onClick={() => setFocusState("downtime")}
        />
        <KpiCard
          label="Total Observed Hours"
          value={formatHours(currentSummary.totalObservedMinutes)}
          subtitle={`${currentSummary.sampleCount} samples`}
          change={kpiChange?.hours ? { label: `vs previous ${kpiChange.hours}`, direction: "neutral" } : null}
          tone="neutral"
          onClick={handleRefresh}
        />
        <KpiCard
          label="Biggest Loss"
          value={currentSummary.biggestLossReason}
          subtitle={formatDurationMinutes(currentSummary.biggestLossMinutes)}
          change={canCompare && previousSummary.biggestLossReason !== currentSummary.biggestLossReason ? { label: `previous: ${previousSummary.biggestLossReason}`, direction: "neutral" } : null}
          tone="neutral"
          onClick={() => {
            setActiveTab("status");
            setBusinessStateFilter("downtime");
            setStatusDescriptionFilter(currentSummary.biggestLossReason);
          }}
        />
        <KpiCard
          label="Worst Press"
          value={worstPress ? formatMachineDisplayName(worstPress.key) : "--"}
          subtitle={worstPress ? "Lowest Good Time %" : "No comparison data"}
          change={canCompare && previousSummary.worstSelectedPress !== currentSummary.worstSelectedPress ? { label: `previous: ${previousSummary.worstSelectedPress}`, direction: "neutral" } : null}
          tone="downtime"
          onClick={() => worstPress && focusPress(worstPress.key)}
        />
        <KpiCard
          label="Best Press"
          value={bestPress ? formatMachineDisplayName(bestPress.key) : "--"}
          subtitle={bestPress ? "Highest Good Time %" : "No comparison data"}
          change={canCompare && previousSummary.bestSelectedPress !== currentSummary.bestSelectedPress ? { label: `previous: ${previousSummary.bestSelectedPress}`, direction: "neutral" } : null}
          tone="good"
          onClick={() => bestPress && focusPress(bestPress.key)}
        />
      </section>

      {analysis.error ? (
        <section className="panel status-analysis-panel analysis-error-banner">
          <SectionHeader
            eyebrow="Analysis source"
            title="Unable to load analysis data"
            helper={analysis.error}
          />
          <p className="analysis-helper">
            If PostgreSQL lives in another application, this page needs that source exposed through an API or a reachable database connection.
          </p>
        </section>
      ) : null}

      <section className="status-analysis-main-grid">
        <article className="panel status-analysis-panel">
          <SectionHeader
            eyebrow="Timeline"
            title={formatMachineDisplayName(primaryMachineId)}
            helper="Click a segment to narrow the drilldown to a status, operator, or job."
            meta={<span>{timelineIntervals.length} segments</span>}
          />
          {isLoading ? <LoadingSkeleton /> : <Timeline
            intervals={timelineIntervals}
            selectedStatusDescription={statusDescriptionFilter}
            selectedBusinessState={businessStateFilter}
            onSelectSegment={selectTimelineInterval}
          />}
        </article>

        <article className="panel status-analysis-panel">
          <SectionHeader
            eyebrow="Loss breakdown"
            title={`${getBusinessStateLabel(businessStateFilter)} causes`}
            helper="Use this to answer where time disappeared and what the dominant cause was."
            meta={<span>{lossRows.length} reasons</span>}
          />
          {lossRows.length ? (
            <div className="loss-chart">
              {lossRows.slice(0, 8).map((row) => (
                <button
                  key={row.key}
                  type="button"
                  className="loss-row"
                  onClick={() => {
                    setActiveTab("status");
                    setStatusDescriptionFilter(row.key);
                  }}
                >
                  <div className="loss-row-head">
                    <strong>{row.label}</strong>
                    <span>{formatDurationMinutes(row.totalMinutes)}</span>
                  </div>
                  <div className="percent-meter">
                    <span className="percent-fill percent-fill-downtime" style={{ width: percentageWidth(row.totalMinutes, currentSummary.totalObservedMinutes || row.totalMinutes) }} />
                  </div>
                  <div className="loss-row-foot">
                    <span>{formatPercent(row.totalMinutes, currentSummary.totalObservedMinutes)}</span>
                    <span>{formatPercent(row.totalMinutes, focusedLossTotalMinutes)} of focus</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No loss rows for this selection"
              description="Change the business state or selected presses to surface the dominant loss reasons."
            />
          )}
        </article>
      </section>

      <section className="panel status-analysis-panel">
        <SectionHeader
          eyebrow="Press comparison"
          title="Lowest Good Time % first"
          helper="A compact comparison to see which press should be inspected next."
          meta={<span>{sortedComparisonRows.length} presses</span>}
        />
        <MetricTable
          rows={sortedComparisonRows}
          sortKey={comparisonSort}
          onSortChange={(key) => sortRows(key, comparisonSort, setComparisonSort)}
          highlightKey={worstPress?.key}
          columns={[
            { key: "label", label: "Press", sortable: true },
            { key: "goodMinutes", label: "Good", sortable: true, numeric: true },
            { key: "setupMinutes", label: "Setup", sortable: true, numeric: true },
            { key: "downtimeMinutes", label: "Downtime", sortable: true, numeric: true },
            { key: "totalMinutes", label: "Total Hours", sortable: true, numeric: true },
            { key: "topLossReason", label: "Top Loss", sortable: true },
            { key: "topLossMinutes", label: "Loss Minutes", sortable: true, numeric: true },
            { key: "mix", label: "Mix", sortable: false }
          ]}
          emptyLabel="No presses match the current selection."
        />
      </section>

      <section className="status-analysis-lower-grid">
        <article className="panel status-analysis-panel">
          <SectionHeader
            eyebrow="Day-by-day"
            title="Which day was better?"
            helper="Use this to spot whether one day underperformed the rest."
            meta={<span>{dayRows.length} days</span>}
          />
        <MetricTable
          rows={dayRows}
          sortKey={daySort}
          onSortChange={(key) => sortRows(key, daySort, setDaySort)}
          highlightKey={null}
          columns={[
              { key: "label", label: "Day", sortable: true },
              { key: "goodMinutes", label: "Good", sortable: true, numeric: true },
              { key: "setupMinutes", label: "Setup", sortable: true, numeric: true },
              { key: "downtimeMinutes", label: "Downtime", sortable: true, numeric: true },
              { key: "totalMinutes", label: "Total Hours", sortable: true, numeric: true },
              { key: "topLossReason", label: "Biggest Loss", sortable: true },
              { key: "topLossMinutes", label: "Loss Minutes", sortable: true, numeric: true },
              { key: "mix", label: "Trend", sortable: false }
            ]}
            emptyLabel="No day breakdown available for the selected range."
          />
        </article>

        <article className="panel status-analysis-panel drilldown-panel">
          <SectionHeader
            eyebrow="Drilldowns"
            title="Inspect the loss from different angles"
            helper={DRILL_TABS.find((tab) => tab.value === activeTab)?.helper}
            meta={<span>{sortedDrillRows.length} rows</span>}
          />

          <div className="drilldown-tabs">
            {DRILL_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={activeTab === tab.value ? "drilldown-tab drilldown-tab-active" : "drilldown-tab"}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="drilldown-controls">
            <label className="analysis-field">
              <span>Business state</span>
              <select className="analysis-input" value={businessStateFilter} onChange={(event) => setBusinessStateFilter(event.target.value)}>
                {BUSINESS_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="analysis-field">
              <span>Event type</span>
              <select className="analysis-input" value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}>
                <option value="all">All</option>
                {analysis.filter_options.eventTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="analysis-field">
              <span>Status description</span>
              <select className="analysis-input" value={statusDescriptionFilter} onChange={(event) => setStatusDescriptionFilter(event.target.value)}>
                <option value="all">All</option>
                {analysis.filter_options.statusDescriptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="analysis-field">
              <span>Operator</span>
              <select className="analysis-input" value={operationCodeFilter} onChange={(event) => setOperationCodeFilter(event.target.value)}>
                <option value="all">All</option>
                {analysis.filter_options.operationCodes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="analysis-field">
              <span>Job</span>
              <select className="analysis-input" value={jobCodeFilter} onChange={(event) => setJobCodeFilter(event.target.value)}>
                <option value="all">All</option>
                {analysis.filter_options.jobCodes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="drilldown-summary-grid">
            <div className="drilldown-summary-card">
              <span>Good %</span>
              <strong>{formatPercent(currentSummary.goodMinutes, currentSummary.totalObservedMinutes)}</strong>
            </div>
            <div className="drilldown-summary-card">
              <span>Setup %</span>
              <strong>{formatPercent(currentSummary.setupMinutes, currentSummary.totalObservedMinutes)}</strong>
            </div>
            <div className="drilldown-summary-card">
              <span>Downtime %</span>
              <strong>{formatPercent(currentSummary.downtimeMinutes, currentSummary.totalObservedMinutes)}</strong>
            </div>
            <div className="drilldown-summary-card">
              <span>Total hours</span>
              <strong>{formatHours(currentSummary.totalObservedMinutes)}</strong>
            </div>
            <div className="drilldown-summary-card">
              <span>Top loss reason</span>
              <strong>{currentSummary.biggestLossReason}</strong>
            </div>
            <div className="drilldown-summary-card">
              <span>Sample size</span>
              <strong>{currentSummary.sampleCount} samples</strong>
            </div>
          </div>

          <MetricTable
            rows={sortedDrillRows}
            sortKey={drillSort}
            onSortChange={(key) => sortRows(key, drillSort, setDrillSort)}
            highlightKey={activeTab === "press" && primaryMachineId ? primaryMachineId : null}
            kind="drilldown"
            columns={[
              { key: "label", label: activeTab === "day" ? "Day" : "Reason / Press", sortable: true },
              { key: "goodMinutes", label: "Good", sortable: true, numeric: true },
              { key: "setupMinutes", label: "Setup", sortable: true, numeric: true },
              { key: "downtimeMinutes", label: "Downtime", sortable: true, numeric: true },
              { key: "totalMinutes", label: "Total Hours", sortable: true, numeric: true },
              { key: "topLossReason", label: "Top Loss", sortable: true },
              { key: "topLossMinutes", label: "Loss Minutes", sortable: true, numeric: true },
              { key: "mix", label: "Mix", sortable: false },
              { key: "sampleCount", label: "Samples", sortable: true, numeric: true }
            ]}
            emptyLabel="No rows match the current drilldown filters."
          />
        </article>
      </section>

      <FocusNextCard recommendation={focusRecommendation} onDrillInto={drillIntoRecommendation} />

      <DebugPanel currentDebug={analysis.debug} previousDebug={previousAnalysis.debug} />
    </section>
  );
}
