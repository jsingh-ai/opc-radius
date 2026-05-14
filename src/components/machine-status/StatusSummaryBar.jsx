export function StatusSummaryBar({ summary, machineCount, isLoading }) {
  return (
    <section className="summary-grid">
      <article className="panel summary-card accent-blue">
        <p className="label">Total machines</p>
        <h3>{isLoading && machineCount === 0 ? "--" : machineCount}</h3>
      </article>

      <article className="panel summary-card accent-green">
        <p className="label">Running production</p>
        <h3>{summary.running}</h3>
      </article>

      <article className="panel summary-card accent-amber">
        <p className="label">Make ready</p>
        <h3>{summary.makeReady}</h3>
      </article>

      <article className="panel summary-card accent-slate">
        <p className="label">Attention needed</p>
        <h3>{summary.attention}</h3>
      </article>
    </section>
  );
}
