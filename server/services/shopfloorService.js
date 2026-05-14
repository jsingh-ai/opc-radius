import { config } from "../config.js";
import { AppError } from "../lib/http.js";
import { validateAndNormalizeMachinePayload } from "../models/machineStatusModel.js";

function buildStatusUrl() {
  const url = new URL("/api/v1/shopfloor/current-status", config.shopfloor.baseUrl);
  url.searchParams.set("kco", config.shopfloor.kco);
  url.searchParams.set("plantCode", config.shopfloor.plantCode);
  url.searchParams.set("machPrefix", config.shopfloor.machPrefix);
  url.searchParams.set(
    "includeEventDetails",
    config.shopfloor.includeEventDetails
  );
  return url;
}

export async function fetchCurrentMachineStatus() {
  let response;

  try {
    response = await fetch(buildStatusUrl(), {
      headers: {
        accept: "application/json",
        "X-API-Key": config.shopfloor.apiKey,
        "User-Agent": "press-radius-opc-dashboard/1.0"
      },
      signal: AbortSignal.timeout(config.shopfloor.upstreamTimeoutMs)
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new AppError(504, "Upstream machine status service timed out.");
    }

    throw new AppError(502, "Unable to connect to the upstream machine status service.");
  }

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new AppError(502, "Upstream service returned invalid JSON.");
  }

  if (!response.ok) {
    throw new AppError(502, "Upstream machine status service is unavailable.");
  }

  const fetchedAt = new Date().toISOString();
  let data;

  try {
    data = validateAndNormalizeMachinePayload(payload);
  } catch {
    throw new AppError(502, "Upstream machine status payload failed validation.");
  }

  return {
    fetchedAt,
    source: {
      kco: config.shopfloor.kco,
      plantCode: config.shopfloor.plantCode,
      machPrefix: config.shopfloor.machPrefix,
      includeEventDetails: config.shopfloor.includeEventDetails
    },
    data
  };
}
