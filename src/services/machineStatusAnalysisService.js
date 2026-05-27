import { apiGet } from "./api/client";

function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  if (params?.since) {
    searchParams.set("since", params.since);
  }

  if (params?.until) {
    searchParams.set("until", params.until);
  }

  if (params?.windowHours) {
    searchParams.set("windowHours", String(params.windowHours));
  }

  if (Array.isArray(params?.machineIds) && params.machineIds.length > 0) {
    searchParams.set("machineIds", params.machineIds.join(","));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchMachineStatusAnalysis(params = {}) {
  const payload = await apiGet(`/api/machine-status/analysis${buildQueryString(params)}`);

  return {
    databaseConfigured: Boolean(payload?.databaseConfigured),
    generatedAt: payload?.generatedAt || new Date().toISOString(),
    windowHours: payload?.windowHours ?? params.windowHours ?? 24,
    since: payload?.since || null,
    until: payload?.until || null,
    summary: payload?.summary || {
      machineCount: 0,
      trackedMinutes: 0,
      statusCount: 0,
      latestIntervalAt: null
    },
    statusTotals: Array.isArray(payload?.statusTotals) ? payload.statusTotals : [],
    machineBreakdown: Array.isArray(payload?.machineBreakdown) ? payload.machineBreakdown : [],
    recentIntervals: Array.isArray(payload?.recentIntervals) ? payload.recentIntervals : []
  };
}
