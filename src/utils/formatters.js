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

export function formatRelativeCountdown(milliseconds) {
  if (milliseconds <= 0) {
    return "Refreshing now";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
