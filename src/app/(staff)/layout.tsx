import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { AiChatLauncher } from "@/components/ai/AiChatLauncher";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
      {/* P1 Gap #11 — staff compliance coach */}
      <AiChatLauncher mode="STAFF_COACH" />
    </div>
  );
}
