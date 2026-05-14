const intervalOptions = [1, 5, 10, 15, 30];

export function RefreshControls({
  intervalMinutes,
  onIntervalChange,
  countdownLabel,
  lastFetchedLabel,
  persistence,
  isLoading,
  onRefresh
}) {
  return (
    <section className="panel refresh-panel">
      <div className="refresh-row">
        <div>
          <p className="label">Refresh interval</p>
          <select
            className="select-field"
            value={intervalMinutes}
            onChange={(event) => onIntervalChange(Number(event.target.value))}
          >
            {intervalOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                Every {minutes} minute{minutes === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      <div className="refresh-meta-grid">
        <div>
          <p className="label">Next refresh</p>
          <p className="value-emphasis">{countdownLabel}</p>
        </div>
        <div>
          <p className="label">Last fetched</p>
          <p className="value-emphasis">{lastFetchedLabel}</p>
        </div>
        <div>
          <p className="label">Database</p>
          <p className="value-emphasis">
            {persistence?.persisted
              ? `Saved ${persistence.count} records`
              : "Not saved"}
          </p>
        </div>
      </div>
    </section>
  );
}
