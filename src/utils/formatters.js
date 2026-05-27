export function formatTimestampLabel(timestamp) {
  if (!timestamp) {
    return "Waiting for first successful fetch";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

export function formatMachineDisplayName(machineId) {
  const digits = String(machineId ?? "").replace(/\D/g, "");

  if (!digits) {
    return `Press ${machineId || "Unknown"}`;
  }

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

export function formatRelativeCountdown(milliseconds) {
  if (milliseconds <= 0) {
    return "Refreshing now";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationMinutes(minutes) {
  const totalMinutes = Number(minutes || 0);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "0m";
  }

  const roundedMinutes = Math.round(totalMinutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatPercent(value, total) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

export function getMachineTone(statusDescription = "") {
  const normalized = statusDescription.toLowerCase();

  if (normalized.includes("run")) {
    return "tone-running";
  }

  if (
    normalized.includes("hold") ||
    normalized.includes("non productive") ||
    normalized.includes("down")
  ) {
    return "tone-attention";
  }

  return "tone-neutral";
}
