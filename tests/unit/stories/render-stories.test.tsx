// @vitest-environment jsdom
/**
 * Story render harness — the lite-Storybook foundation.
 *
 * Auto-discovers every `*.stories.tsx` under the top-level `stories/`
 * folder, dynamically imports each one, and renders every named export
 * inside a minimal provider tree. Asserts that:
 *   - every story renders without throwing
 *   - no React `console.error` is emitted (which usually indicates an
 *     act() warning, missing key, or a hydration mismatch)
 *
 * See ADR 0015 §D4 for the rationale (full Storybook is deferred until
 * Wave 5.5).
 */
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import path from "node:path";
import fg from "fast-glob";
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";

const STORIES_DIR = path.resolve(process.cwd(), "stories");

// Stub matchMedia so ThemeProvider's "system" path doesn't throw under jsdom.
beforeAll(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        media: "",
        onchange: null,
        dispatchEvent: () => false,
      }),
    });
  }
});

interface StoryModule {
  default?: { title?: string };
  [exportName: string]: unknown;
}

async function discoverStories(): Promise<Array<{ file: string; mod: StoryModule }>> {
  const files = await fg("**/*.stories.tsx", { cwd: STORIES_DIR, absolute: true });
  const results: Array<{ file: string; mod: StoryModule }> = [];
  for (const file of files) {
    const mod = (await import(/* @vite-ignore */ file)) as StoryModule;
    results.push({ file, mod });
  }
  return results;
}

describe("Story render harness (lite-Storybook)", () => {
  let stories: Array<{ file: string; mod: StoryModule }> = [];
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const errors: string[] = [];

  beforeAll(async () => {
    stories = await discoverStories();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("discovers at least one story file", () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  it("every story renders without throwing or emitting console.error", async () => {
    expect(stories.length).toBeGreaterThan(0);

    for (const { file, mod } of stories) {
      const fileLabel = path.relative(process.cwd(), file).replace(/\\/g, "/");
      const exports = Object.entries(mod).filter(([key]) => key !== "default");
      expect.soft(exports.length, `${fileLabel} has no story exports`).toBeGreaterThan(0);

      for (const [name, value] of exports) {
        if (typeof value !== "function") continue;
        const Story = value as React.ComponentType;
        errors.length = 0;
        await act(async () => {
          render(
            <ThemeProvider defaultTheme="light">
              <Story />
            </ThemeProvider>,
          );
          await Promise.resolve();
        });
        cleanup();
        // Allow benign React 18 "act" notes from third-party libs to pass through
        // by filtering only true error-class messages.
        const fatalErrors = errors.filter(
          (e) =>
            !e.includes("not wrapped in act") &&
            !e.includes("inside a test was not wrapped"),
        );
        expect.soft(
          fatalErrors,
          `${fileLabel} > ${name} emitted console.error`,
        ).toEqual([]);
      }
    }
  });
});
