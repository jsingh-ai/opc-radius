import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const icon = theme === "dark" ? "☾" : "☀";

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme}>
      <span className="theme-toggle-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="theme-toggle-copy">
        <span className="label">Theme</span>
        <strong>{theme === "dark" ? "Dark mode" : "Light mode"}</strong>
      </div>
    </button>
  );
}
