/**
 * Deterministic date formatters.
 *
 * `toLocaleDateString()` without an explicit `timeZone` uses whichever TZ the
 * running process is in. In Next.js App Router, that means the server
 * container (UTC in our Docker images) and the user's browser (usually
 * America/New_York) produce different strings for the same Date — which
 * causes React hydration mismatches.
 *
 * These helpers pin locale + timezone so server and client always agree.
 * `America/New_York` is used because Essen's business operations are in NY
 * and end-users think of dates in eastern time.
 */

const DEFAULT_TZ = "America/New_York";
const DEFAULT_LOCALE = "en-US";

type DateInput = Date | string | number | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** M/D/YYYY — short date, stable across server/client. */
export function formatDate(input: DateInput, fallback = "—"): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
}

/** "Apr 16, 2026" — long date, stable. */
export function formatDateLong(input: DateInput, fallback = "—"): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** "4/16/2026, 9:32 AM" — date + time, stable. */
export function formatDateTime(input: DateInput, fallback = "—"): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "9:32 AM" — time only, stable. */
export function formatTime(input: DateInput, fallback = "—"): string {
  const d = toDate(input);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
