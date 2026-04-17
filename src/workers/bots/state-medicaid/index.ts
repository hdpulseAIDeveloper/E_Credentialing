/**
 * State Medicaid exclusion plug-in registry.
 *
 * To add a new state, import the plug-in and register it in PLUGINS below,
 * then add the state code to the STATE_MEDICAID_PLUGINS env var.
 */

import { nyOmigPlugin } from "./ny-omig";
import type { StateMedicaidPlugin } from "./types";

const PLUGINS: Record<string, StateMedicaidPlugin> = {
  NY: nyOmigPlugin,
  // Future plug-ins go here:
  // NJ: njMfdPlugin,
  // CA: caMedicalPlugin,
  // FL: flAhcaPlugin,
  // TX: txOigPlugin,
  // ...
};

export function getPlugin(state: string): StateMedicaidPlugin | null {
  return PLUGINS[state.toUpperCase()] ?? null;
}

/** Returns the list of state codes that have a registered plug-in. */
export function getRegisteredStates(): string[] {
  return Object.keys(PLUGINS).sort();
}

/**
 * Returns the list of state codes whose plug-in is currently enabled,
 * intersected with STATE_MEDICAID_PLUGINS env var (default: all registered).
 */
export function getActiveStates(): string[] {
  const envList = (process.env.STATE_MEDICAID_PLUGINS ?? getRegisteredStates().join(","))
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return envList.filter((s) => {
    const plugin = PLUGINS[s];
    return !!plugin && plugin.isEnabled();
  });
}

/**
 * Whether a state has a *registered* (not necessarily enabled) plug-in.
 * Used by the 30-day sweep to count "skipped because no plug-in" vs.
 * "skipped because not enabled yet".
 */
export function hasPlugin(state: string): boolean {
  return !!PLUGINS[state.toUpperCase()];
}

export type { StateMedicaidPlugin };
