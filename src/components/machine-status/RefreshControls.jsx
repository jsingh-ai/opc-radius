const intervalOptions = [1, 5, 10, 15, 30];

export function RefreshControls({
  intervalMinutes,
  onIntervalChange,
  countdownLabel,
  lastFetchedLabel,
  scheduler,
  serverRefreshLabel,
  canManualRefresh,
  isLoading,
  onRefresh
}) {
  return (
    <section className="panel refresh-panel">
      <div className="refresh-row">
        <div>
          <p className="label">Dashboard refresh interval</p>
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

        {canManualRefresh ? (
          <button
            type="button"
            className="primary-button"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh now"}
          </button>
        ) : null}
      </div>

      <div className="refresh-meta-grid">
        <div>
          <p className="label">Dashboard refresh</p>
          <p className="value-emphasis">{countdownLabel}</p>
        </div>
        <div>
          <p className="label">Latest DB sync</p>
          <p className="value-emphasis">{lastFetchedLabel}</p>
        </div>
        <div>
          <p className="label">Server polling</p>
          <p className="value-emphasis">
            {scheduler?.intervalSeconds
              ? `Every ${scheduler.intervalSeconds} sec`
              : "Not available"}
          </p>
        </div>
        <div>
          <p className="label">Next server sync</p>
          <p className="value-emphasis">{serverRefreshLabel}</p>
        </div>
        <div>
          <p className="label">Scheduler state</p>
          <p className="value-emphasis">
            {scheduler?.isRunning ? "Syncing now" : scheduler?.lastSucceededAt ? "Active" : "Starting"}
          </p>
        </div>
      </div>
    </section>
  );
}
