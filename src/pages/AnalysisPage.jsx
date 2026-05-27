import { useEffect, useMemo, useState } from "react";
import { usePageHeader } from "../context/PageHeaderContext";
import { useMachineStatusAnalysis } from "../hooks/useMachineStatusAnalysis";
import { fetchMachineStatuses } from "../services/machineStatusService";
import {
  formatDurationMinutes,
  formatMachineDisplayName,
  formatPercent
} from "../utils/formatters";

function toDateTimeLocalValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function AnalysisMetric({ label, value, detail }) {
  return (
    <article className="panel metric-card">
      <p className="label">{label}</p>
      <h3>{value}</h3>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </article>
  );
}

function StatusStack({ statusTotals, totalMinutes }) {
  return (
    <div className="status-stack" aria-hidden="true">
      {statusTotals.map((status) => (
        <span
          key={status.statusDescription}
          className="status-segment"
          title={`${status.statusDescription}: ${formatDurationMinutes(status.trackedMinutes)} (${formatPercent(status.trackedMinutes, totalMinutes)})`}
          style={{
            width: `${Math.max(1, (status.trackedMinutes / Math.max(1, totalMinutes)) * 100)}%`
          }}
        />
      ))}
    </div>
  );
}

function StatusLegend({ statusTotals, totalMinutes }) {
  return (
    <div className="status-legend">
      {statusTotals.map((status) => (
        <div key={status.statusDescription} className="status-legend-row">
          <div>
            <strong>{status.statusDescription}</strong>
            <p>
              {formatDurationMinutes(status.trackedMinutes)} · {formatPercent(status.trackedMinutes, totalMinutes)}
            </p>
          </div>
          <span className="status-legend-percent">{formatPercent(status.trackedMinutes, totalMinutes)}</span>
        </div>
      ))}
    </div>
  );
}

function MachineCard({ machine }) {
  const displayName = formatMachineDisplayName(machine.machineId);
  const dominantStatus = machine.statusTotals[0] || null;

  return (
    <article className="panel machine-analysis-card">
      <div className="analysis-panel-header">
        <div>
          <p className="eyebrow">Press</p>
          <h3>{displayName}</h3>
          <p className="analysis-subtitle">{machine.machineId}</p>
        </div>
        <div className="analysis-card-meta">
          <p className="label">Tracked</p>
          <strong>{formatDurationMinutes(machine.trackedMinutes)}</strong>
        </div>
      </div>

      {dominantStatus ? (
        <p className="analysis-card-dominant">
          Dominant status: <strong>{dominantStatus.statusDescription}</strong>
        </p>
      ) : null}

      <StatusStack statusTotals={machine.statusTotals} totalMinutes={machine.trackedMinutes} />

      <div className="machine-status-breakdown">
        {machine.statusTotals.map((status) => (
          <div key={status.statusDescription} className="machine-status-row">
            <div className="machine-status-name">
              <strong>{status.statusDescription}</strong>
              <span>{formatPercent(status.trackedMinutes, machine.trackedMinutes)}</span>
            </div>
            <div className="machine-status-values">
              <span>{formatDurationMinutes(status.trackedMinutes)}</span>
              <span>{Math.round(status.trackedMinutes)} min</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AnalysisPage() {
  const [draftSince, setDraftSince] = useState(() => toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [draftUntil, setDraftUntil] = useState(() => toDateTimeLocalValue(new Date()));
  const [draftMachineIds, setDraftMachineIds] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({
    since: fromDateTimeLocalValue(toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000))),
    until: fromDateTimeLocalValue(toDateTimeLocalValue(new Date())),
    machineIds: []
  });
  const [availableMachines, setAvailableMachines] = useState([]);
  const [machineListError, setMachineListError] = useState("");
  const [machineListLoading, setMachineListLoading] = useState(true);
  const { setHeaderState, defaultHeaderState } = usePageHeader();

  useEffect(() => {
    let isMounted = true;

    async function loadMachines() {
      try {
        const response = await fetchMachineStatuses();

        if (!isMounted) {
          return;
        }

        setAvailableMachines(response.machines);

        if (response.machines.length > 0) {
          const machineIds = response.machines.map((machine) => machine.machineId);
          setDraftMachineIds(machineIds);
          setAppliedFilters((current) => ({
            ...current,
            machineIds
          }));
        }
      } catch (error) {
        if (isMounted) {
          setMachineListError(
            error instanceof Error ? error.message : "Failed to load available presses."
          );
        }
      } finally {
        if (isMounted) {
          setMachineListLoading(false);
        }
      }
    }

    loadMachines();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setHeaderState({
      eyebrow: "Historical Analysis",
      title: "Status Time Analysis",
      detailLabel: "Window",
      detailValue: "Custom range"
    });

    return () => {
      setHeaderState(defaultHeaderState);
    };
  }, [defaultHeaderState, setHeaderState]);

  const analysisParams = useMemo(
    () => ({
      since: appliedFilters.since,
      until: appliedFilters.until,
      machineIds: appliedFilters.machineIds
    }),
    [appliedFilters]
  );

  const dashboard = useMachineStatusAnalysis(analysisParams);

  const latestRangeLabel = dashboard.since && dashboard.until
    ? `${formatTimestamp(dashboard.since)} - ${formatTimestamp(dashboard.until)}`
    : "No range selected";

  const topStatus = useMemo(() => dashboard.statusTotals[0] || null, [dashboard.statusTotals]);

  function handleToggleMachine(machineId) {
    setDraftMachineIds((current) => (
      current.includes(machineId)
        ? current.filter((value) => value !== machineId)
        : [...current, machineId]
    ));
  }

  function handleSelectAll() {
    const machineIds = availableMachines.map((machine) => machine.machineId);
    setDraftMachineIds(machineIds);
  }

  function handleClearAll() {
    setDraftMachineIds([]);
  }

  function handleApplyFilters() {
    setAppliedFilters({
      since: fromDateTimeLocalValue(draftSince),
      until: fromDateTimeLocalValue(draftUntil),
      machineIds: draftMachineIds
    });
  }

  function handleResetWindow() {
    const sinceValue = toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const untilValue = toDateTimeLocalValue(new Date());

    setDraftSince(sinceValue);
    setDraftUntil(untilValue);
  }

  const selectedMachineCount = draftMachineIds.length;
  const trackedHours = dashboard.summary.trackedMinutes / 60;

  return (
    <section className="analysis-page">
      <section className="panel analysis-hero">
        <div className="analysis-hero-copy">
          <p className="eyebrow">Machine status time</p>
          <h3>Compare presses by exact status time.</h3>
          <p className="hero-copy">
            Pick a time range, then compare one or more presses side by side. The page
            calculates how long each machine spent in each status description from the
            stored history intervals.
          </p>
        </div>

        <div className="analysis-controls">
          <div className="analysis-select-block">
            <span className="label">Time range</span>
            <div className="time-range-grid">
              <label className="field-group">
                <span>From</span>
                <input
                  type="datetime-local"
                  className="select-field"
                  value={draftSince}
                  onChange={(event) => setDraftSince(event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>To</span>
                <input
                  type="datetime-local"
                  className="select-field"
                  value={draftUntil}
                  onChange={(event) => setDraftUntil(event.target.value)}
                />
              </label>
            </div>
            <div className="filter-actions">
              <button type="button" className="window-chip" onClick={handleResetWindow}>
                Last 24h
              </button>
              <button type="button" className="window-chip" onClick={handleApplyFilters}>
                Apply time filter
              </button>
            </div>
          </div>

          <div className="analysis-meta">
            <p className="label">Loaded</p>
            <p className="value-emphasis">{dashboard.lastLoadedLabel}</p>
            <p className="analysis-meta-copy">{latestRangeLabel}</p>
          </div>
        </div>
      </section>

      <section className="panel analysis-panel">
        <div className="analysis-panel-header">
          <div>
            <p className="eyebrow">Compare presses</p>
            <h3>Select machines to include</h3>
          </div>
          <div className="analysis-panel-note">
            {selectedMachineCount} selected
          </div>
        </div>

        {machineListLoading ? (
          <p className="analysis-empty">Loading presses...</p>
        ) : null}

        {machineListError ? (
          <section className="panel state-panel error-panel">
            <p className="eyebrow">Press List Error</p>
            <p>{machineListError}</p>
          </section>
        ) : null}

        <div className="filter-actions">
          <button type="button" className="window-chip" onClick={handleSelectAll}>
            Select all
          </button>
          <button type="button" className="window-chip" onClick={handleClearAll}>
            Clear
          </button>
          <button type="button" className="window-chip window-chip-active" onClick={handleApplyFilters}>
            Apply presses
          </button>
        </div>

        <div className="machine-picker">
          {availableMachines.map((machine) => {
            const isSelected = draftMachineIds.includes(machine.machineId);
            return (
              <button
                key={machine.machineId}
                type="button"
                className={isSelected ? "machine-chip machine-chip-active" : "machine-chip"}
                onClick={() => handleToggleMachine(machine.machineId)}
              >
                <strong>{machine.displayName || formatMachineDisplayName(machine.machineId)}</strong>
                <span>{machine.machineId}</span>
              </button>
            );
          })}
          {!machineListLoading && availableMachines.length === 0 ? (
            <p className="analysis-empty">No presses were returned by the current machine list.</p>
          ) : null}
        </div>
      </section>

      <section className="summary-grid">
        <AnalysisMetric
          label="Presses"
          value={dashboard.summary.machineCount}
          detail="Machines with tracked intervals"
        />
        <AnalysisMetric
          label="Tracked time"
          value={formatDurationMinutes(dashboard.summary.trackedMinutes)}
          detail={trackedHours ? `${trackedHours.toFixed(1)} hours` : "Estimated from history rows"}
        />
        <AnalysisMetric
          label="Statuses"
          value={dashboard.summary.statusCount}
          detail="Distinct status descriptions"
        />
        <AnalysisMetric
          label="Top status"
          value={topStatus ? topStatus.statusDescription : "--"}
          detail={
            topStatus
              ? `${formatDurationMinutes(topStatus.trackedMinutes)} · ${formatPercent(topStatus.trackedMinutes, dashboard.summary.trackedMinutes)}`
              : "No data yet"
          }
        />
      </section>

      {dashboard.error ? (
        <section className="panel state-panel error-panel">
          <p className="eyebrow">Fetch Error</p>
          <h3>Machine status analysis is unavailable</h3>
          <p>{dashboard.error}</p>
        </section>
      ) : null}

      <section className="analysis-grid">
        <article className="panel analysis-panel">
          <div className="analysis-panel-header">
            <div>
              <p className="eyebrow">All selected presses</p>
              <h3>Time by status description</h3>
            </div>
            <p className="analysis-panel-note">{dashboard.statusTotals.length} statuses</p>
          </div>

          {dashboard.statusTotals.length > 0 ? (
            <>
              <StatusStack
                statusTotals={dashboard.statusTotals}
                totalMinutes={dashboard.summary.trackedMinutes}
              />
              <StatusLegend
                statusTotals={dashboard.statusTotals}
                totalMinutes={dashboard.summary.trackedMinutes}
              />
            </>
          ) : (
            <p className="analysis-empty">No status durations found in the selected window.</p>
          )}
        </article>

        <article className="panel analysis-panel">
          <div className="analysis-panel-header">
            <div>
              <p className="eyebrow">Window</p>
              <h3>Recent status intervals</h3>
            </div>
            <p className="analysis-panel-note">{dashboard.recentIntervals.length} rows</p>
          </div>

          <div className="interval-list">
            {dashboard.recentIntervals.map((interval) => (
              <div key={`${interval.machineId}-${interval.startAt}-${interval.endAt}`} className="interval-row">
                <div>
                  <strong>{formatMachineDisplayName(interval.machineId)}</strong>
                  <p>{interval.statusDescription || "--"}</p>
                </div>
                <div>
                  <strong>{formatDurationMinutes(interval.minutes)}</strong>
                  <p>
                    {formatTimestamp(interval.startAt)} - {formatTimestamp(interval.endAt)}
                  </p>
                </div>
              </div>
            ))}
            {!dashboard.recentIntervals.length && !dashboard.isLoading ? (
              <p className="analysis-empty">No intervals found in the selected window.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="analysis-machine-grid">
        {dashboard.machineBreakdown.map((machine) => (
          <MachineCard key={machine.machineId} machine={machine} />
        ))}
        {!dashboard.machineBreakdown.length && !dashboard.isLoading ? (
          <section className="panel state-panel">
            <p className="eyebrow">No Data</p>
            <h3>No machine history was available for the selected window</h3>
          </section>
        ) : null}
      </section>
    </section>
  );
}
