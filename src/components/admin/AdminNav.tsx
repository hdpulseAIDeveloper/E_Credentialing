"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Settings, Shield, LayoutDashboard, Stethoscope, Network } from "lucide-react";

interface AdminNavProps {
  userRole: string;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/provider-types", label: "Provider Types", icon: Stethoscope },
  { href: "/admin/workflows", label: "Workflows", icon: Network },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/admin/roles", label: "Roles & Permissions", icon: Shield, adminOnly: true },
];

export function AdminNav({ userRole }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200 bg-white rounded-t-lg -mx-6 -mt-6 px-6 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500 mt-0.5">System configuration, user management, and access control</p>
        </div>
      </div>
      <nav className="flex gap-1 -mb-px">
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && userRole !== "ADMIN") return null;
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && pathname !== "/admin";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
