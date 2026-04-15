import Link from "next/link";
import type { Task, Provider } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type TaskWithProvider = Task & {
  provider: Pick<Provider, "id" | "legalFirstName" | "legalLastName">;
};

interface Props {
  tasks: TaskWithProvider[];
}

export function TaskList({ tasks }: Props) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">My Tasks</h2>
        <span className="text-xs text-gray-400">{tasks.length} open</span>
      </div>
      <div className="divide-y max-h-96 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No open tasks</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-3">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0",
                    task.priority === "HIGH"
                      ? "bg-red-100 text-red-700"
                      : task.priority === "MEDIUM"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {task.priority[0]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                  <Link
                    href={`/providers/${task.provider.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {task.provider.legalFirstName} {task.provider.legalLastName}
                  </Link>
                  {task.dueDate && (
                    <div className={cn(
                      "text-xs mt-0.5",
                      task.dueDate < new Date() ? "text-red-500 font-medium" : "text-gray-400"
                    )}>
                      Due {formatDistanceToNow(task.dueDate, { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
