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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function fetchMachineStatusAnalysis(params = {}) {
  const payload = await apiGet(`/api/machine-status/analysis${buildQueryString(params)}`);

  return {
    databaseConfigured: Boolean(payload?.databaseConfigured),
    generatedAt: payload?.generatedAt || new Date().toISOString(),
    windowHours: payload?.windowHours ?? params.windowHours ?? 24,
    since: payload?.since || null,
    until: payload?.until || null,
    availableMachines: normalizeArray(payload?.availableMachines),
    primaryMachineId: payload?.primaryMachineId || null,
    intervals: normalizeArray(payload?.intervals),
    summary: payload?.summary || {
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
    selected_press_timeline: payload?.selected_press_timeline || { machineId: null, displayName: "", intervals: [] },
    press_comparison: normalizeArray(payload?.press_comparison),
    day_breakdown: normalizeArray(payload?.day_breakdown),
    status_breakdown: normalizeArray(payload?.status_breakdown),
    operator_breakdown: normalizeArray(payload?.operator_breakdown),
    job_breakdown: normalizeArray(payload?.job_breakdown),
    filter_options: payload?.filter_options || {
      machineIds: [],
      eventTypes: [],
      statusDescriptions: [],
      operationCodes: [],
      jobCodes: []
    },
    debug: payload?.debug || null
  };
}
