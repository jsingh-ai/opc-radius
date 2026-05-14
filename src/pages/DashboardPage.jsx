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
            The server polls the shopfloor status endpoint on a fixed schedule,
            stores the results in PostgreSQL, and this dashboard reads the latest
            saved machine state for a consistent view across users.
          </p>
        </div>

        <RefreshControls
          intervalMinutes={dashboard.intervalMinutes}
          onIntervalChange={dashboard.setIntervalMinutes}
          countdownLabel={dashboard.countdownLabel}
          lastFetchedLabel={dashboard.lastFetchedLabel}
          scheduler={dashboard.scheduler}
          serverRefreshLabel={dashboard.serverRefreshLabel}
          canManualRefresh={dashboard.canManualRefresh}
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
