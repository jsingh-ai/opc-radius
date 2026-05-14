import { apiGet, apiPost } from "./api/client";

function normalizeMachine(record) {
  const machineId = cleanString(record.machineId) || "Unknown";

  return {
    kco: record.kco ?? "--",
    plantCode: record.plantCode ?? "--",
    machineId,
    displayName: buildMachineDisplayName(machineId),
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

function buildMachineDisplayName(machineId) {
  const digits = String(machineId).replace(/\D/g, "");

  if (digits.length >= 3) {
    const pressNumber = Number(digits.slice(-2));

    if (!Number.isNaN(pressNumber) && pressNumber > 0) {
      return `Press ${pressNumber}`;
    }
  }

  return `Press ${machineId}`;
}

export async function fetchMachineStatuses() {
  const payload = await apiGet("/api/machine-status/current-status");
  const rawMachines = Array.isArray(payload?.machines) ? payload.machines : [];

  return {
    fetchedAt: payload?.fetchedAt || new Date().toISOString(),
    scheduler: payload?.scheduler || null,
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
