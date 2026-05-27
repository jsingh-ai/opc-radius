import { apiGet, apiPost } from "./api/client";
import { formatMachineDisplayName } from "../utils/formatters";

function normalizeMachine(record) {
  const machineId = cleanString(record.machineId) || "Unknown";

  return {
    kco: record.kco ?? "--",
    plantCode: record.plantCode ?? "--",
    machineId,
    displayName: formatMachineDisplayName(machineId),
    jobCode: cleanString(record.jobCode),
    operationCode: cleanString(record.operationCode),
    eventType: cleanString(record.eventType),
    statusCode: cleanString(record.statusCode),
    statusDescription: cleanString(record.statusDescription),
    eventStartTime: cleanString(record.eventStartTime),
    eventSeqCode: cleanString(record.eventSeqCode)
  };
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export async function fetchMachineStatuses() {
  const payload = await apiGet("/api/machine-status/current-status");
  const rawMachines = Array.isArray(payload?.machines) ? payload.machines : [];

  return {
    fetchedAt: payload?.fetchedAt || new Date().toISOString(),
    scheduler: payload?.scheduler || null,
    debug: {
      machineCount: rawMachines.length,
      machineIds: rawMachines.map((machine) => cleanString(machine.machineId)).filter(Boolean).slice(0, 20),
      statusDescriptions: rawMachines
        .map((machine) => cleanString(machine.statusDescription))
        .filter(Boolean)
        .slice(0, 20),
      source: payload?.source || null
    },
    machines: rawMachines
      .map(normalizeMachine)
      .sort((left, right) => left.machineId.localeCompare(right.machineId))
  };
}

export async function triggerMachineStatusRefresh() {
  const payload = await apiPost("/api/machine-status/current-status/refresh");

  return {
    fetchedAt: payload?.fetchedAt || new Date().toISOString(),
    scheduler: payload?.scheduler || null,
    persisted: payload?.persistence || null,
    skipped: Boolean(payload?.skipped)
  };
}
