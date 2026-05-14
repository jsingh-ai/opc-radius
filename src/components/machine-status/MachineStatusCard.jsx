import { getMachineTone } from "../../utils/formatters";

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || "--"}</strong>
    </div>
  );
}

export function MachineStatusCard({ machine }) {
  const toneClass = getMachineTone(machine.statusDescription);

  return (
    <article className={`panel machine-card ${toneClass}`}>
      <div className="machine-card-header">
        <div>
          <p className="label">Machine</p>
          <h3>{machine.displayName || machine.machineId}</h3>
          <p className="machine-subtitle">Machine ID {machine.machineId}</p>
        </div>
        <span className="status-chip">{machine.eventType || "--"}</span>
      </div>

      <div className="machine-status-block">
        <p className="machine-status-title">{machine.statusDescription || "Unknown"}</p>
        <p className="machine-status-code">Status Code {machine.statusCode || "--"}</p>
      </div>

      <div className="machine-details">
        <DetailRow label="Job" value={machine.jobCode} />
        <DetailRow label="Operation" value={machine.operationCode} />
        <DetailRow label="Plant" value={machine.plantCode} />
      </div>
    </article>
  );
}
