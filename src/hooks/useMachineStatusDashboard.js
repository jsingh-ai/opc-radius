import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMachineStatuses } from "../services/machineStatusService";
import { formatTimestampLabel } from "../utils/formatters";

const DEFAULT_INTERVAL_MINUTES = 5;

export function useMachineStatusDashboard() {
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(DEFAULT_INTERVAL_MINUTES);
  const [lastFetchedAt, setLastFetchedAt] = useState("");
  const timerRef = useRef(null);

  const loadCurrentState = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetchMachineStatuses();
      setMachines(response.machines);
      setLastFetchedAt(response.fetchedAt);
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
    loadCurrentState();
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      loadCurrentState();
    }, intervalMinutes * 60 * 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [intervalMinutes]);
  const lastFetchedLabel = formatTimestampLabel(lastFetchedAt);

  const summary = useMemo(() => {
    let running = 0;
    let makeReady = 0;
    let attention = 0;

    machines.forEach((machine) => {
      const status = machine.statusDescription || "Unknown";
      const normalizedStatus = status.toLowerCase();

      if (normalizedStatus.includes("make ready")) {
        makeReady += 1;
      } else if (normalizedStatus.includes("run")) {
        running += 1;
      } else {
        attention += 1;
      }
    });

    return {
      running,
      makeReady,
      attention
    };
  }, [machines]);

  return {
    machines,
    isLoading,
    error,
    intervalMinutes,
    lastFetchedLabel,
    summary
  };
}
