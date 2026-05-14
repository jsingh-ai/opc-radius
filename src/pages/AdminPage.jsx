import { useAdminPresenceDashboard } from "../hooks/useAdminPresenceDashboard";

export function AdminPage() {
  const dashboard = useAdminPresenceDashboard();

  return (
    <section className="dashboard-page">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Admin Telemetry</p>
          <h3>Dashboard Presence</h3>
          <p className="hero-copy">
            This view tracks active browser sessions using heartbeat telemetry,
            so you can see how many dashboard instances are open and where they
            are currently sitting.
          </p>
        </div>

        <section className="panel refresh-panel">
          <p className="label">Last loaded</p>
          <p className="value-emphasis">{dashboard.lastLoadedLabel}</p>
          <p className="label admin-note">
            Active sessions are counted within the last {dashboard.activeWindowSeconds} seconds.
          </p>
        </section>
      </div>

      <section className="summary-grid">
        <article className="panel summary-card accent-blue">
          <p className="label">Active sessions</p>
          <h3>{dashboard.summary.activeSessionCount}</h3>
        </article>
        <article className="panel summary-card accent-green">
          <p className="label">Active routes</p>
          <h3>{dashboard.summary.activeRouteCount}</h3>
        </article>
        <article className="panel summary-card accent-amber">
          <p className="label">Sessions last 24h</p>
          <h3>{dashboard.summary.sessionsLast24h}</h3>
        </article>
      </section>

      {dashboard.error ? (
        <section className="panel state-panel error-panel">
          <p className="eyebrow">Fetch Error</p>
          <h3>Presence telemetry is unavailable</h3>
          <p>{dashboard.error}</p>
        </section>
      ) : null}

      <section className="admin-grid">
        <article className="panel admin-panel">
          <p className="eyebrow">By Route</p>
          <h3>Open Page Counts</h3>
          <div className="admin-table">
            {dashboard.routes.map((route) => (
              <div key={route.currentPath} className="detail-row">
                <span>{route.currentPath}</span>
                <strong>{route.activeCount}</strong>
              </div>
            ))}
            {!dashboard.isLoading && dashboard.routes.length === 0 ? (
              <p className="admin-empty">No active routes right now.</p>
            ) : null}
          </div>
        </article>

        <article className="panel admin-panel">
          <p className="eyebrow">Active Sessions</p>
          <h3>Recent Browser Instances</h3>
          <div className="admin-table">
            {dashboard.sessions.map((session) => (
              <div key={session.sessionId} className="admin-session-card">
                <div className="detail-row">
                  <span>Path</span>
                  <strong>{session.currentPath}</strong>
                </div>
                <div className="detail-row">
                  <span>Theme</span>
                  <strong>{session.theme || "--"}</strong>
                </div>
                <div className="detail-row">
                  <span>Opened</span>
                  <strong>{session.firstSeenAt ? new Date(session.firstSeenAt).toLocaleString() : "--"}</strong>
                </div>
                <div className="detail-row">
                  <span>Last seen</span>
                  <strong>{session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : "--"}</strong>
                </div>
                <div className="detail-row">
                  <span>Viewport</span>
                  <strong>
                    {session.viewportWidth && session.viewportHeight
                      ? `${session.viewportWidth} x ${session.viewportHeight}`
                      : "--"}
                  </strong>
                </div>
              </div>
            ))}
            {!dashboard.isLoading && dashboard.sessions.length === 0 ? (
              <p className="admin-empty">No active sessions right now.</p>
            ) : null}
          </div>
        </article>
      </section>
    </section>
  );
}
