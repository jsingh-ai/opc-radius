import { config } from "../config.js";

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
  if (!config.shopfloor.apiKey) {
    throw new Error("SHOPFLOOR_API_KEY is not configured on the server.");
  }

  const response = await fetch(buildStatusUrl(), {
    headers: {
      accept: "application/json",
      "X-API-Key": config.shopfloor.apiKey
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error("Failed to fetch machine status from upstream API.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const fetchedAt = new Date().toISOString();

  return {
    fetchedAt,
    source: {
      kco: config.shopfloor.kco,
      plantCode: config.shopfloor.plantCode,
      machPrefix: config.shopfloor.machPrefix,
      includeEventDetails: config.shopfloor.includeEventDetails
    },
    data: payload
  };
}
