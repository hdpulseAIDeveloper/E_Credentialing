import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  const stats = await Promise.all([
    db.user.count(),
    db.provider.count(),
    db.providerType.count(),
    db.botRun.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 mt-1">System configuration and user management</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats[0] },
          { label: "Total Providers", value: stats[1] },
          { label: "Provider Types", value: stats[2] },
          { label: "Failed Bot Runs", value: stats[3] },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/admin/users", label: "User Management", desc: "Create, edit, and deactivate staff users" },
          { href: "/admin/provider-types", label: "Provider Types", desc: "Configure provider types and document requirements" },
          { href: "/bull-board", label: "Queue Dashboard", desc: "Monitor BullMQ job queues (Bull Board)" },
        ].map((link) => (
          <a key={link.href} href={link.href} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">{link.label}</h3>
            <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
