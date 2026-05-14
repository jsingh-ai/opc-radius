import { useEffect, useState } from "react";
import { apiGet } from "../services/api/client";
import { formatTimestampLabel } from "../utils/formatters";

const REFRESH_INTERVAL_MS = 30000;

export function useAdminPresenceDashboard() {
  const [data, setData] = useState({
    summary: {
      activeSessionCount: 0,
      sessionsLast24h: 0,
      activeRouteCount: 0
    },
    routes: [],
    sessions: [],
    activeWindowSeconds: 90
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
        }

        const response = await apiGet("/api/admin/dashboard-presence");

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
              : "Failed to load dashboard presence."
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
  }, []);

  return {
    ...data,
    isLoading,
    error,
    lastLoadedLabel: formatTimestampLabel(lastLoadedAt)
  };
}
