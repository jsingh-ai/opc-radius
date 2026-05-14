import { MachineStatusGrid } from "../components/machine-status/MachineStatusGrid";
import { StatusSummaryBar } from "../components/machine-status/StatusSummaryBar";
import { usePageHeader } from "../context/PageHeaderContext";
import { useMachineStatusDashboard } from "../hooks/useMachineStatusDashboard";
import { useEffect } from "react";

export function DashboardPage() {
  const dashboard = useMachineStatusDashboard();
  const { setHeaderState, defaultHeaderState } = usePageHeader();

  useEffect(() => {
    setHeaderState({
      eyebrow: "Production Overview",
      title: "Machine Status Command Center",
      detailLabel: "Last DB Sync",
      detailValue: dashboard.lastFetchedLabel
    });

    return () => {
      setHeaderState(defaultHeaderState);
    };
  }, [dashboard.lastFetchedLabel, defaultHeaderState, setHeaderState]);

  return (
    <section className="dashboard-page">
      <StatusSummaryBar
        summary={dashboard.summary}
        machineCount={dashboard.machines.length}
        isLoading={dashboard.isLoading}
      />

      <MachineStatusGrid
        machines={dashboard.machines}
        isLoading={dashboard.isLoading}
        error={dashboard.error}
      />
    </section>
  );
}
