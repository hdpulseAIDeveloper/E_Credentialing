/**
 * Hard-fail fixtures per `docs/qa/STANDARD.md` §4.1 and §1.3:
 *
 *   - `consoleErrors`     — every browser console.error is collected; if
 *                           non-empty at teardown, the test fails. Includes
 *                           hydration warnings, "Cannot read properties of
 *                           undefined", failed-to-load-resource, etc.
 *   - `pageErrors`        — uncaught exceptions on the page (`page.on(
 *                           "pageerror")`).
 *   - `networkErrors`     — first-party 5xx responses observed during the
 *                           test. 4xx is allowed (could be a deliberate
 *                           negative test) but 5xx is always a bug.
 *
 * The fixtures attach listeners on `page` automatically. Tests don't have to
 * remember to call them. They're applied via `extend({...})` so importing
 * `test` from `tests/e2e/fixtures` opts you in.
 *
 * ANTI-WEAKENING (§4.2): do NOT lower these to warnings or filter out
 * categories of errors here. If a known-noisy log keeps tripping the gate,
 * fix the source — silencing it in the fixture is a §4.2 violation.
 */

import { test as base, expect, type Page } from "@playwright/test";

export interface ConsoleHit {
  text: string;
  location?: string;
}

export interface NetworkHit {
  url: string;
  status: number;
  method: string;
}

interface ErrorBag {
  consoleErrors: ConsoleHit[];
  pageErrors: Error[];
  networkErrors: NetworkHit[];
}

const BENIGN_CONSOLE_RE = [
  // Next.js dev mode emits a single info message on first paint with the
  // React DevTools install link. It is *not* an error in any sense — it's a
  // console.log that some browsers report at info level. We never see it as
  // console.error, so it does not bypass the gate, but if it ever does we
  // do NOT want to filter it here. Keeping list explicit to make it obvious
  // when we're tempted to silence something.
] as RegExp[];

const FIRST_PARTY_HOSTS = [
  // Anything served by the app under test. baseURL is added at runtime in
  // attachListeners().
];

function attachListeners(page: Page, bag: ErrorBag, baseURL: string): void {
  const baseHost = (() => {
    try {
      return new URL(baseURL).host;
    } catch {
      return "";
    }
  })();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (BENIGN_CONSOLE_RE.some((re) => re.test(text))) return;
    bag.consoleErrors.push({
      text,
      location: msg.location().url
        ? `${msg.location().url}:${msg.location().lineNumber}`
        : undefined,
    });
  });

  page.on("pageerror", (err) => {
    bag.pageErrors.push(err);
  });

  page.on("response", (resp) => {
    const url = resp.url();
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      return;
    }
    const isFirstParty =
      host === baseHost ||
      FIRST_PARTY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    if (!isFirstParty) return;
    if (resp.status() >= 500) {
      bag.networkErrors.push({
        url,
        status: resp.status(),
        method: resp.request().method(),
      });
    }
  });
}

/**
 * Composed test base. Every spec under tests/e2e/** should import `test`
 * from this module rather than from "@playwright/test" directly so the
 * console / network listeners are wired automatically.
 */
export const test = base.extend<{
  errorBag: ErrorBag;
}>({
  errorBag: async ({ page, baseURL }, use, testInfo) => {
    const bag: ErrorBag = {
      consoleErrors: [],
      pageErrors: [],
      networkErrors: [],
    };
    attachListeners(page, bag, baseURL ?? "http://localhost:6015");

    await use(bag);

    // Attach evidence to the test report regardless of pass/fail so a green
    // run still has the artifact trail required by §4.1.
    if (
      bag.consoleErrors.length > 0 ||
      bag.pageErrors.length > 0 ||
      bag.networkErrors.length > 0
    ) {
      await testInfo.attach("error-bag.json", {
        body: JSON.stringify(bag, null, 2),
        contentType: "application/json",
      });
    }

    // Hard-fail the test if anything landed in the bag.
    expect(
      bag.consoleErrors,
      `Browser console.error(s) during test:\n${bag.consoleErrors
        .map((c) => `  - ${c.text}${c.location ? ` (${c.location})` : ""}`)
        .join("\n")}`,
    ).toEqual([]);

    expect(
      bag.pageErrors.map((e) => e.message),
      `Uncaught page errors during test:\n${bag.pageErrors
        .map((e) => `  - ${e.message}`)
        .join("\n")}`,
    ).toEqual([]);

    expect(
      bag.networkErrors,
      `First-party 5xx responses during test:\n${bag.networkErrors
        .map((n) => `  - ${n.method} ${n.url} -> ${n.status}`)
        .join("\n")}`,
    ).toEqual([]);
  },
});

export { expect } from "@playwright/test";
