import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMachineStatuses } from "../services/machineStatusService";
import { formatRelativeCountdown, formatTimestampLabel } from "../utils/formatters";

const DEFAULT_INTERVAL_MINUTES = 5;

export function useMachineStatusDashboard() {
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(DEFAULT_INTERVAL_MINUTES);
  const [lastFetchedAt, setLastFetchedAt] = useState("");
  const [nextRefreshAt, setNextRefreshAt] = useState(Date.now());
  const [persistence, setPersistence] = useState(null);
  const timerRef = useRef(null);

  const refreshNow = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetchMachineStatuses();
      setMachines(response.machines);
      setLastFetchedAt(response.fetchedAt);
      setPersistence(response.persistence);
      setNextRefreshAt(Date.now() + intervalMinutes * 60 * 1000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unexpected error while loading machine status data."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshNow();
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    setNextRefreshAt(Date.now() + intervalMinutes * 60 * 1000);

    timerRef.current = window.setInterval(() => {
      refreshNow();
    }, intervalMinutes * 60 * 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [intervalMinutes]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdownLabel = formatRelativeCountdown(nextRefreshAt - now);
  const lastFetchedLabel = formatTimestampLabel(lastFetchedAt);

  const summary = useMemo(() => {
    const uniqueStatuses = new Set();
    let running = 0;
    let attention = 0;

    machines.forEach((machine) => {
      const status = machine.statusDescription || "Unknown";
      uniqueStatuses.add(status);

      if (status.toLowerCase().includes("run")) {
        running += 1;
      } else {
        attention += 1;
      }
    });

    return {
      running,
      attention,
      uniqueStatuses: uniqueStatuses.size
    };
  }, [machines]);

  return {
    machines,
    isLoading,
    error,
    intervalMinutes,
    setIntervalMinutes,
    refreshNow,
    countdownLabel,
    lastFetchedLabel,
    summary,
    persistence
  };
}
