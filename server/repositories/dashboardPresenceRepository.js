import { getPool } from "../db/index.js";

const ACTIVE_WINDOW_SECONDS = 90;
const RECENT_WINDOW_HOURS = 24;
const RETENTION_DAYS = 14;

export async function upsertDashboardPresence(payload, userAgent) {
  const db = getPool();
  const now = new Date().toISOString();

  await db.query(
    `
      insert into dashboard_view_sessions (
        session_id,
        current_path,
        page_title,
        theme,
        first_seen_at,
        last_seen_at,
        last_unloaded_at,
        user_agent,
        viewport_width,
        viewport_height,
        meta
      )
      values ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, '{}'::jsonb)
      on conflict (session_id) do update set
        current_path = excluded.current_path,
        page_title = excluded.page_title,
        theme = excluded.theme,
        last_seen_at = excluded.last_seen_at,
        last_unloaded_at = excluded.last_unloaded_at,
        user_agent = excluded.user_agent,
        viewport_width = excluded.viewport_width,
        viewport_height = excluded.viewport_height
    `,
    [
      payload.sessionId,
      payload.currentPath,
      payload.pageTitle || null,
      payload.theme || null,
      now,
      payload.event === "pagehide" ? now : null,
      userAgent || null,
      payload.viewportWidth ?? null,
      payload.viewportHeight ?? null
    ]
  );

  return {
    recordedAt: now,
    activeWindowSeconds: ACTIVE_WINDOW_SECONDS
  };
}

export async function pruneDashboardPresenceSessions() {
  const db = getPool();

  await db.query(
    `
      delete from dashboard_view_sessions
      where last_seen_at < now() - make_interval(days => $1)
    `,
    [RETENTION_DAYS]
  );
}

export async function getDashboardPresenceSummary() {
  const db = getPool();

  const [overviewResult, routesResult, sessionsResult] = await Promise.all([
    db.query(
      `
        select
          count(*) filter (
            where last_seen_at >= now() - make_interval(secs => $1)
              and (last_unloaded_at is null or last_unloaded_at < last_seen_at)
          ) as active_session_count,
          count(*) filter (
            where first_seen_at >= now() - make_interval(hours => $2)
          ) as sessions_last_24h,
          count(distinct current_path) filter (
            where last_seen_at >= now() - make_interval(secs => $1)
              and (last_unloaded_at is null or last_unloaded_at < last_seen_at)
          ) as active_route_count
        from dashboard_view_sessions
      `,
      [ACTIVE_WINDOW_SECONDS, RECENT_WINDOW_HOURS]
    ),
    db.query(
      `
        select
          current_path,
          count(*) as active_count
        from dashboard_view_sessions
        where last_seen_at >= now() - make_interval(secs => $1)
          and (last_unloaded_at is null or last_unloaded_at < last_seen_at)
        group by current_path
        order by active_count desc, current_path asc
      `,
      [ACTIVE_WINDOW_SECONDS]
    ),
    db.query(
      `
        select
          session_id,
          current_path,
          page_title,
          theme,
          first_seen_at,
          last_seen_at,
          viewport_width,
          viewport_height
        from dashboard_view_sessions
        where last_seen_at >= now() - make_interval(secs => $1)
          and (last_unloaded_at is null or last_unloaded_at < last_seen_at)
        order by last_seen_at desc
        limit 50
      `,
      [ACTIVE_WINDOW_SECONDS]
    )
  ]);

  const overview = overviewResult.rows[0] || {};

  return {
    activeWindowSeconds: ACTIVE_WINDOW_SECONDS,
    summary: {
      activeSessionCount: Number(overview.active_session_count || 0),
      sessionsLast24h: Number(overview.sessions_last_24h || 0),
      activeRouteCount: Number(overview.active_route_count || 0)
    },
    routes: routesResult.rows.map((row) => ({
      currentPath: row.current_path,
      activeCount: Number(row.active_count)
    })),
    sessions: sessionsResult.rows.map((row) => ({
      sessionId: row.session_id,
      currentPath: row.current_path,
      pageTitle: row.page_title,
      theme: row.theme,
      firstSeenAt: row.first_seen_at?.toISOString?.() || null,
      lastSeenAt: row.last_seen_at?.toISOString?.() || null,
      viewportWidth: row.viewport_width,
      viewportHeight: row.viewport_height
    }))
  };
}
