"use client";

/**
 * ThemeToggle — accessible 3-state Light / Dark / System toggle.
 *
 * Uses lucide-react icons (already a dependency). Renders as a small
 * toolbar of three buttons with `aria-pressed` to communicate state to
 * assistive tech. Keyboard navigable via Tab + Enter/Space (native
 * <button> behavior).
 */
import * as React from "react";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface OptionDef {
  value: Theme;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: ReadonlyArray<OptionDef> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export interface ThemeToggleProps {
  className?: string;
  /** Hide labels and show icons only. */
  iconOnly?: boolean;
}

export function ThemeToggle({ className, iconOnly = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {iconOnly ? null : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
