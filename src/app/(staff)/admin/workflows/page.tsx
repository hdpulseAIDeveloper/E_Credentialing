import { api } from "@/trpc/server";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { CreateWorkflowButton, WorkflowCardActions } from "@/components/admin/WorkflowActions";
import { WorkflowGrid } from "@/components/admin/WorkflowGrid";

export default async function AdminWorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/dashboard");

  const isAdmin = session.user.role === "ADMIN";
  let workflows: Awaited<ReturnType<typeof api.admin.listWorkflows>> = [];
  try {
    workflows = await api.admin.listWorkflows();
  } catch {
    workflows = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Workflows</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Visual workflow diagrams for credentialing processes
          </p>
        </div>
        {isAdmin && <CreateWorkflowButton />}
      </div>

      <WorkflowGrid workflows={workflows} isAdmin={isAdmin} />
    </div>
  );
}
