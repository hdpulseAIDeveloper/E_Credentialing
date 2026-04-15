import { db } from "@/server/db";
import Link from "next/link";
import { Users, Stethoscope, Settings, Shield, Activity, AlertTriangle } from "lucide-react";

export default async function AdminPage() {
  const [userCount, providerCount, providerTypeCount, failedBots, activeUsers, inactiveUsers] =
    await Promise.all([
      db.user.count(),
      db.provider.count(),
      db.providerType.count(),
      db.botRun.count({ where: { status: "FAILED" } }),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { isActive: false } }),
    ]);

  const stats = [
    { label: "Total Users", value: userCount, color: "bg-blue-50 text-blue-700" },
    { label: "Active Users", value: activeUsers, color: "bg-green-50 text-green-700" },
    { label: "Inactive Users", value: inactiveUsers, color: "bg-gray-50 text-gray-600" },
    { label: "Total Providers", value: providerCount, color: "bg-indigo-50 text-indigo-700" },
    { label: "Provider Types", value: providerTypeCount, color: "bg-purple-50 text-purple-700" },
    { label: "Failed Bot Runs", value: failedBots, color: failedBots > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600" },
  ];

  const quickLinks = [
    { href: "/admin/users", label: "User Management", desc: "Create, edit, and deactivate staff users", icon: Users, color: "text-blue-600" },
    { href: "/admin/provider-types", label: "Provider Types", desc: "Configure provider types and document requirements", icon: Stethoscope, color: "text-purple-600" },
    { href: "/admin/settings", label: "Application Settings", desc: "System-wide preferences for workflows and notifications", icon: Settings, color: "text-gray-600" },
    { href: "/admin/roles", label: "Roles & Permissions", desc: "View role definitions and permission matrix", icon: Shield, color: "text-green-600" },
    { href: "/bull-board", label: "Queue Dashboard", desc: "Monitor BullMQ job queues (Bull Board)", icon: Activity, color: "text-orange-600", external: true },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-lg border p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {failedBots > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-800">
              {failedBots} bot run{failedBots !== 1 ? "s" : ""} failed
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              Check the Queue Dashboard for details and retry options.
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const Tag = link.external ? "a" : Link;
          return (
            <Tag
              key={link.href}
              href={link.href}
              className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`h-5 w-5 ${link.color}`} />
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {link.label}
                </h3>
              </div>
              <p className="text-sm text-gray-500">{link.desc}</p>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
