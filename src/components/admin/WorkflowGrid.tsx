"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowCardActions } from "@/components/admin/WorkflowActions";
import { Network } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  onboarding: "Onboarding",
  committee: "Committee",
  enrollment: "Enrollment",
  bots: "Bots / PSV",
  expirables: "Expirables",
  sanctions: "Sanctions",
  medicaid: "Medicaid / ETIN",
  npdb: "NPDB",
  privileges: "Privileges",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  onboarding: "bg-blue-100 text-blue-700",
  committee: "bg-purple-100 text-purple-700",
  enrollment: "bg-green-100 text-green-700",
  bots: "bg-orange-100 text-orange-700",
  expirables: "bg-red-100 text-red-700",
  sanctions: "bg-yellow-100 text-yellow-800",
  medicaid: "bg-teal-100 text-teal-700",
  npdb: "bg-indigo-100 text-indigo-700",
  privileges: "bg-pink-100 text-pink-700",
};

interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail: string | null;
  isPublished: boolean;
  updatedAt: Date;
  creator: { displayName: string | null };
}

interface WorkflowGridProps {
  workflows: WorkflowItem[];
  isAdmin: boolean;
}

export function WorkflowGrid({ workflows, isAdmin }: WorkflowGridProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(workflows.map((w) => w.category))).sort()];
  const filtered = filter === "all" ? workflows : workflows.filter((w) => w.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat] ?? cat}
            {cat !== "all" && (
              <span className="ml-1 opacity-70">
                ({workflows.filter((w) => w.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
          <Network className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            {workflows.length === 0
              ? "No workflows yet. Create your first workflow to get started."
              : "No workflows in this category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              onClick={() => router.push(`/admin/workflows/${w.id}`)}
              className="group cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600">
                    {w.name}
                  </h3>
                  {w.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{w.description}</p>
                  )}
                </div>
                <WorkflowCardActions workflowId={w.id} workflowName={w.name} isAdmin={isAdmin} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[w.category] ?? CATEGORY_COLORS.general}`}>
                  {CATEGORY_LABELS[w.category] ?? w.category}
                </span>
                <span>
                  Updated {new Date(w.updatedAt).toLocaleDateString()}
                </span>
              </div>

              {w.creator.displayName && (
                <p className="mt-1 text-xs text-gray-400">by {w.creator.displayName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
