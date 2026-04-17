"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: UserRole;
  };
}

type NavItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

// Standalone item shown above the grouped accordion (always visible).
const TOP_NAV: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];

// Grouped, collapsible navigation. Single-accordion: opening one closes the
// others. All groups start collapsed; the group containing the current route
// auto-expands on mount so the active page is visible.
const NAV_GROUPS: NavGroup[] = [
  {
    id: "providers",
    label: "Provider Lifecycle",
    items: [
      { href: "/providers", label: "Providers" },
      { href: "/verifications", label: "Verifications" },
      { href: "/recredentialing", label: "Recredentialing" },
      { href: "/behavioral-health", label: "Behavioral Health" },
    ],
  },
  {
    id: "committee",
    label: "Committee & Quality",
    items: [
      { href: "/committee", label: "Committee" },
      { href: "/peer-review", label: "Peer Review" },
      { href: "/evaluations", label: "OPPE/FPPE" },
    ],
  },
  {
    id: "enrollments",
    label: "Enrollments & Payers",
    items: [
      { href: "/enrollments", label: "Enrollments" },
      { href: "/medicaid", label: "NY Medicaid" },
      { href: "/roster", label: "Rosters" },
      { href: "/telehealth", label: "Telehealth" },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring & Compliance",
    items: [
      { href: "/monitoring", label: "Monitoring" },
      { href: "/expirables", label: "Expirables" },
      { href: "/fsmb-pdc", label: "FSMB PDC" },
      { href: "/bots/exceptions", label: "Bot Exceptions" },
      { href: "/compliance", label: "Compliance Readiness" },
    ],
  },
  {
    id: "training",
    label: "Training",
    items: [
      { href: "/training", label: "My Training" },
      { href: "/cme", label: "CME Tracking" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports" },
      { href: "/scorecards", label: "Scorecards" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Admin", roles: ["ADMIN", "MANAGER"] as string[] },
];

function findGroupForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some((item) => pathname.startsWith(item.href))) {
      return group.id;
    }
  }
  return null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  // All groups collapsed by default. On mount (and whenever the route changes
  // to a different group), auto-expand the group containing the active route
  // so the user can see where they are. Single-accordion: only one open.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const active = findGroupForPath(pathname);
    if (active) setOpenGroup(active);
  }, [pathname]);

  const ROLE_LABELS: Record<UserRole, string> = {
    PROVIDER: "Provider",
    SPECIALIST: "Specialist",
    MANAGER: "Manager",
    COMMITTEE_MEMBER: "Committee",
    ADMIN: "Admin",
  };

  const toggleGroup = (id: string) => {
    setOpenGroup((current) => (current === id ? null : id));
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo */}
      <Link
        href="/"
        className="block p-6 border-b border-gray-700 hover:bg-gray-800 transition-colors"
      >
        <div className="text-lg font-bold">ESSEN</div>
        <div className="text-xs text-gray-400">Credentialing Platform</div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col overflow-y-auto">
        <div className="space-y-0.5">
          {TOP_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Grouped nav */}
        <div className="mt-3 space-y-1">
          {NAV_GROUPS.map((group) => {
            const isOpen = openGroup === group.id;
            const containsActive = group.items.some((item) =>
              pathname.startsWith(item.href)
            );
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={`nav-group-${group.id}`}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    containsActive
                      ? "text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>
                {isOpen && (
                  <div
                    id={`nav-group-${group.id}`}
                    className="mt-0.5 ml-2 pl-2 border-l border-gray-700 space-y-0.5"
                  >
                    {group.items.map((item) => {
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "block px-3 py-1.5 rounded-lg text-sm transition-colors",
                            isActive
                              ? "bg-blue-600 text-white font-medium"
                              : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Separator + Admin section */}
        {ADMIN_NAV.filter((item) => item.roles.includes(user.role)).length > 0 && (
          <div className="mt-auto pt-4 border-t border-gray-700 space-y-0.5">
            {ADMIN_NAV.map((item) => {
              if (!item.roles.includes(user.role)) return null;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-sm font-medium text-white truncate">
          {user.name ?? user.email}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[user.role]}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
