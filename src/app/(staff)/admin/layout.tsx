import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <AdminNav userRole={session.user.role} />
      {children}
    </div>
  );
}
