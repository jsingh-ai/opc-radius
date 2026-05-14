import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme}>
      <span className="label">Theme</span>
      <strong>{theme === "dark" ? "Dark mode" : "Light mode"}</strong>
    </button>
  );
}
