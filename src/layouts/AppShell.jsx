import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../components/app/ThemeToggle";
import { usePageHeader } from "../context/PageHeaderContext";
import { usePagePresence } from "../hooks/usePagePresence";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/analysis", label: "Analysis" },
  { to: "/admin", label: "Admin" }
];

export function AppShell() {
  const appTitle = import.meta.env.VITE_APP_TITLE || "Press Radius OPC Dashboard";
  const { headerState } = usePageHeader();
  usePagePresence();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Shopfloor Monitoring</p>
          <h1>{appTitle}</h1>
          <p className="brand-copy">
            Real-time operational visibility for machine health, production status,
            and expansion into future plant intelligence screens.
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-content">
            <div>
              <p className="eyebrow">{headerState.eyebrow}</p>
              <h2>{headerState.title}</h2>
            </div>

            {headerState.detailValue ? (
              <div className="topbar-detail">
                <p className="label">{headerState.detailLabel}</p>
                <p className="value-emphasis">{headerState.detailValue}</p>
              </div>
            ) : null}
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
