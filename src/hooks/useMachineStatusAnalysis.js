import { useEffect, useState } from "react";
import { fetchMachineStatusAnalysis } from "../services/machineStatusAnalysisService";
import { formatTimestampLabel } from "../utils/formatters";

const REFRESH_INTERVAL_MS = 60000;

export function useMachineStatusAnalysis(params) {
  const [data, setData] = useState({
    databaseConfigured: false,
    generatedAt: "",
    windowHours: params?.windowHours ?? 24,
    since: null,
    until: null,
    summary: {
      machineCount: 0,
      trackedMinutes: 0,
      statusCount: 0,
      latestIntervalAt: null
    },
    availableMachines: [],
    statusTotals: [],
    machineBreakdown: [],
    recentIntervals: [],
    debug: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        if (isMounted) {
          setError("");
          setIsLoading(true);
        }

        const response = await fetchMachineStatusAnalysis(params);

        if (isMounted) {
          setData(response);
          setLastLoadedAt(new Date().toISOString());
          setIsLoading(false);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load machine status analysis."
          );
          setIsLoading(false);
        }
      }
    }

    load();
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [params]);

  return {
    ...data,
    isLoading,
    error,
    lastLoadedLabel: formatTimestampLabel(lastLoadedAt)
  };
}
