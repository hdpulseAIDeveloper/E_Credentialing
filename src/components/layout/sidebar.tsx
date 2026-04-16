"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/providers", label: "Providers" },
  { href: "/committee", label: "Committee" },
  { href: "/enrollments", label: "Enrollments" },
  { href: "/medicaid", label: "NY Medicaid" },
  { href: "/expirables", label: "Expirables" },
  { href: "/recredentialing", label: "Recredentialing" },
  { href: "/verifications", label: "Verifications" },
  { href: "/evaluations", label: "OPPE/FPPE" },
  { href: "/roster", label: "Rosters" },
  { href: "/cme", label: "CME Tracking" },
  { href: "/telehealth", label: "Telehealth" },
  { href: "/reports", label: "Reports" },
  { href: "/compliance", label: "Compliance" },
  { href: "/scorecards", label: "Scorecards" },
  { href: "/analytics", label: "Analytics" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "Admin", roles: ["ADMIN", "MANAGER"] as string[] },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const ROLE_LABELS: Record<UserRole, string> = {
    PROVIDER: "Provider",
    SPECIALIST: "Specialist",
    MANAGER: "Manager",
    COMMITTEE_MEMBER: "Committee",
    ADMIN: "Admin",
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo */}
      <Link href="/" className="block p-6 border-b border-gray-700 hover:bg-gray-800 transition-colors">
        <div className="text-lg font-bold">ESSEN</div>
        <div className="text-xs text-gray-400">Credentialing Platform</div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col overflow-y-auto">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => {
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
        <div className="text-sm font-medium text-white truncate">{user.name ?? user.email}</div>
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
