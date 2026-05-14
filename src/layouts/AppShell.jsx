import { NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../components/app/ThemeToggle";
import { usePagePresence } from "../hooks/usePagePresence";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/analytics", label: "Analytics" },
  { to: "/operations", label: "Operations" },
  { to: "/admin", label: "Admin" }
];

export function AppShell() {
  const appTitle = import.meta.env.VITE_APP_TITLE || "Press Radius OPC Dashboard";
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
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-content">
            <div>
              <p className="eyebrow">Production Overview</p>
              <h2>Machine Status Command Center</h2>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
