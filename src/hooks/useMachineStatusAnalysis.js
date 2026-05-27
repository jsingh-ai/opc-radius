import { useEffect, useState } from "react";
import { fetchMachineStatusAnalysis } from "../services/machineStatusAnalysisService";
import { formatTimestampLabel } from "../utils/formatters";

const REFRESH_INTERVAL_MS = 60000;

const EMPTY_SUMMARY = {
  goodMinutes: 0,
  setupMinutes: 0,
  downtimeMinutes: 0,
  totalObservedMinutes: 0,
  totalObservedHours: 0,
  goodPercent: 0,
  setupPercent: 0,
  downtimePercent: 0,
  biggestLossReason: "--",
  worstSelectedPress: "--",
  bestSelectedPress: "--",
  sampleCount: 0,
  latestIntervalAt: null
};

export function useMachineStatusAnalysis(params) {
  const [data, setData] = useState({
    databaseConfigured: false,
    generatedAt: "",
    windowHours: params?.windowHours ?? 24,
    since: null,
    until: null,
    availableMachines: [],
    primaryMachineId: null,
    intervals: [],
    summary: EMPTY_SUMMARY,
    selected_press_timeline: {
      machineId: null,
      displayName: "",
      intervals: []
    },
    press_comparison: [],
    day_breakdown: [],
    status_breakdown: [],
    operator_breakdown: [],
    job_breakdown: [],
    filter_options: {
      machineIds: [],
      eventTypes: [],
      statusDescriptions: [],
      operationCodes: [],
      jobCodes: []
    },
    debug: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (params?.enabled === false) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

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
    const intervalId = params?.enabled === false ? null : window.setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [params]);

  return {
    ...data,
    isLoading,
    error,
    lastLoadedLabel: formatTimestampLabel(lastLoadedAt)
  };
}
