import { MachineStatusGrid } from "../components/machine-status/MachineStatusGrid";
import { RefreshControls } from "../components/machine-status/RefreshControls";
import { StatusSummaryBar } from "../components/machine-status/StatusSummaryBar";
import { useMachineStatusDashboard } from "../hooks/useMachineStatusDashboard";

export function DashboardPage() {
  const dashboard = useMachineStatusDashboard();

  return (
    <section className="dashboard-page">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Live Feed</p>
          <h3>Current Status by Machine</h3>
          <p className="hero-copy">
            This dashboard polls the shopfloor status endpoint through the server
            proxy, groups data into machine cards, and keeps refresh behavior
            controllable from the UI.
          </p>
        </div>

        <RefreshControls
          intervalMinutes={dashboard.intervalMinutes}
          onIntervalChange={dashboard.setIntervalMinutes}
          countdownLabel={dashboard.countdownLabel}
          lastFetchedLabel={dashboard.lastFetchedLabel}
          persistence={dashboard.persistence}
          isLoading={dashboard.isLoading}
          onRefresh={dashboard.refreshNow}
        />
      </div>

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
