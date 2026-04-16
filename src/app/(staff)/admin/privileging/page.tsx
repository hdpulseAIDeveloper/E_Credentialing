import { db } from "@/server/db";
import Link from "next/link";

export default async function PrivilegingPage() {
  const categories = await db.privilegeCategory.findMany({
    include: {
      _count: {
        select: { privileges: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privileging Library</h1>
          <p className="text-gray-500 mt-1">
            Manage privilege delineation categories and items — {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </div>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No privilege categories defined yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/admin/privileging/${cat.id}`}
              className="block bg-white rounded-lg border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                  {cat.specialty && (
                    <p className="text-xs text-gray-500 mt-0.5">{cat.specialty}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                    {cat._count.privileges} item{cat._count.privileges !== 1 ? "s" : ""}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
