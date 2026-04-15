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

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/providers", label: "Providers", icon: "user" },
  { href: "/committee", label: "Committee", icon: "users" },
  { href: "/enrollments", label: "Enrollments", icon: "file-text" },
  { href: "/expirables", label: "Expirables", icon: "clock" },
  { href: "/admin", label: "Admin", icon: "settings", roles: ["ADMIN", "MANAGER"] },
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
      <div className="p-6 border-b border-gray-700">
        <div className="text-lg font-bold">ESSEN</div>
        <div className="text-xs text-gray-400">Credentialing Platform</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          if (item.roles && !item.roles.includes(user.role)) return null;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
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
