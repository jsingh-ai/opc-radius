import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "press-radius-presence-session-id";
const HEARTBEAT_INTERVAL_MS = 30000;

function getSessionId() {
  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, sessionId);
  return sessionId;
}

function buildPayload(currentPath, event) {
  return JSON.stringify({
    sessionId: getSessionId(),
    currentPath,
    pageTitle: document.title,
    theme: document.documentElement.dataset.theme || null,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    event
  });
}

function sendHeartbeat(currentPath, event = "heartbeat") {
  const payload = buildPayload(currentPath, event);

  if (event === "pagehide" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/dashboard-view", blob);
    return;
  }

  fetch("/api/telemetry/dashboard-view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: payload,
    keepalive: event === "pagehide"
  }).catch(() => {});
}

export function usePagePresence() {
  const location = useLocation();
  const currentPath = location.pathname;

  useEffect(() => {
    sendHeartbeat(currentPath, "heartbeat");

    const intervalId = window.setInterval(() => {
      sendHeartbeat(currentPath, "heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    const handlePageHide = () => {
      sendHeartbeat(currentPath, "pagehide");
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [currentPath]);
}
