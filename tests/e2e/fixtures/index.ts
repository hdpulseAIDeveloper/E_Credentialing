/**
 * Composed `test` and `expect` for every spec under tests/e2e/** .
 *
 * The composition wires the hard-fail listeners from ./errors.ts so each
 * spec automatically participates in the §4.1 / §4.2 hard-fail policy. To
 * opt out of any listener requires editing this file under CODEOWNERS gate.
 */

export { test, expect } from "./errors";
export type { ConsoleHit, NetworkHit } from "./errors";
