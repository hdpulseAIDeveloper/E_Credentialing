// @vitest-environment jsdom
/**
 * Tests for src/components/theme-provider.tsx.
 *
 * Coverage:
 *   - Reads stored theme from localStorage on mount.
 *   - Falls back to system pref when storage is empty.
 *   - setTheme() persists and toggles `class="dark"` on <html>.
 *   - "system" mode reacts to prefers-color-scheme changes.
 *   - useTheme() throws outside provider.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import {
  ThemeProvider,
  THEME_STORAGE_KEY,
  themeFoucScript,
  useTheme,
} from "@/components/theme-provider";

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: (event: string, cb: (e: { matches: boolean }) => void) => void;
  removeEventListener: (event: string, cb: (e: { matches: boolean }) => void) => void;
  dispatchChange: (matches: boolean) => void;
}

function installMatchMedia(initialDark: boolean): MockMediaQueryList {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql: MockMediaQueryList = {
    matches: initialDark,
    addEventListener: (_event, cb) => listeners.add(cb),
    removeEventListener: (_event, cb) => listeners.delete(cb),
    dispatchChange: (matches) => {
      mql.matches = matches;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return mql;
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button data-testid="to-dark" onClick={() => setTheme("dark")}>dark</button>
      <button data-testid="to-light" onClick={() => setTheme("light")}>light</button>
      <button data-testid="to-system" onClick={() => setTheme("system")}>system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("falls back to system pref (light) when storage is empty", async () => {
    installMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("falls back to system pref (dark) when OS prefers dark", async () => {
    installMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads stored theme on mount and applies the class", async () => {
    installMatchMedia(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme() persists and toggles the html class", async () => {
    installMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => { await Promise.resolve(); });

    await act(async () => { screen.getByTestId("to-dark").click(); });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await act(async () => { screen.getByTestId("to-light").click(); });
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("system mode reacts to prefers-color-scheme changes in real time", async () => {
    const mql = installMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId("resolved").textContent).toBe("light");

    await act(async () => { mql.dispatchChange(true); });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("useTheme() throws when used outside <ThemeProvider>", () => {
    installMatchMedia(false);
    function Bare() {
      useTheme();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});

describe("themeFoucScript", () => {
  it("contains the storage key and a try/catch guard", () => {
    expect(themeFoucScript).toContain(THEME_STORAGE_KEY);
    expect(themeFoucScript).toContain("try");
    expect(themeFoucScript).toContain("catch");
    expect(themeFoucScript).toContain("classList.add('dark')");
  });
});
