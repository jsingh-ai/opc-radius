import { MachineStatusCard } from "./MachineStatusCard";

export function MachineStatusGrid({ machines, isLoading, error }) {
  if (error) {
    return (
      <section className="panel state-panel error-panel">
        <p className="eyebrow">Fetch Error</p>
        <h3>Machine status data is unavailable</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (isLoading && machines.length === 0) {
    return (
      <section className="panel state-panel">
        <p className="eyebrow">Loading</p>
        <h3>Requesting the latest machine status feed</h3>
      </section>
    );
  }

  if (machines.length === 0) {
    return (
      <section className="panel state-panel">
        <p className="eyebrow">No Data</p>
        <h3>No machines were returned by the current API response</h3>
      </section>
    );
  }

  return (
    <section className="machine-grid">
      {machines.map((machine) => (
        <MachineStatusCard key={machine.machineId} machine={machine} />
      ))}
    </section>
  );
}
