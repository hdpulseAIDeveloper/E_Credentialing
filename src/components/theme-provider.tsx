"use client";

/**
 * ThemeProvider — single source of truth for light/dark/system theme.
 *
 * Wave 2.2 design-system consolidation. The CSS variables in
 * `src/app/globals.css` already define both palettes; this provider
 * decides which one is active by toggling `class="dark"` on `<html>`.
 *
 * Behavior:
 *   - On mount we read `localStorage["ecred-theme"]`. If it's "light" or
 *     "dark" we honor it. If it's missing or "system" we fall back to
 *     `prefers-color-scheme`.
 *   - When the user changes the theme via `setTheme()`, we persist the
 *     chosen value AND immediately update the `<html>` class so there is
 *     no flash.
 *   - We listen to `MediaQueryList.change` so a theme of "system" follows
 *     the OS in real time without a reload.
 *
 * Why hand-rolled instead of `next-themes`: see ADR 0015.
 */
import * as React from "react";

export type Theme = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "ecred-theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage may throw in private-browsing modes; fall back silently.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyClass(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if nothing is stored. Defaults to "system". */
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
  }, []);

  React.useEffect(() => {
    const resolve = (): "light" | "dark" =>
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    const r = resolve();
    setResolvedTheme(r);
    applyClass(r);

    if (theme !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const next = systemPrefersDark() ? "dark" : "light";
      setResolvedTheme(next);
      applyClass(next);
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, t);
      } catch {
        // localStorage may throw; the in-memory state still updates.
      }
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme — read/write the active theme. Throws if used outside a
 * ThemeProvider so we surface integration errors loudly during development
 * instead of silently rendering with the wrong palette.
 */
export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Inline FOUC-killer script. Returned as a string so it can be embedded
 * with `dangerouslySetInnerHTML` in `<head>` BEFORE React hydrates.
 *
 * Reads localStorage["ecred-theme"], resolves "system" to the OS pref,
 * then sets class="dark" on <html> if needed. Wrapped in a try/catch so
 * a corrupt localStorage entry never blocks the app from booting.
 */
export const themeFoucScript = `
(function(){try{
  var s=localStorage.getItem('${THEME_STORAGE_KEY}');
  var r=(s==='light'||s==='dark')?s
    :(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  if(r==='dark')document.documentElement.classList.add('dark');
}catch(e){}})();
`.trim();
