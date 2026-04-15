import { api } from "@/trpc/server";
import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { WorkflowEditorShell } from "@/components/admin/WorkflowEditorShell";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowEditorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/dashboard");

  const isAdmin = session.user.role === "ADMIN";

  let workflow;
  try {
    workflow = await api.admin.getWorkflow({ id });
  } catch {
    notFound();
  }

  return (
    <WorkflowEditorShell
      workflow={{
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        sceneData: workflow.sceneData as Record<string, unknown>,
        isPublished: workflow.isPublished,
        updatedAt: workflow.updatedAt.toISOString(),
        creator: workflow.creator.displayName ?? "Unknown",
      }}
      isAdmin={isAdmin}
    />
  );
}
