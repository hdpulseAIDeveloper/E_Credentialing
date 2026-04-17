"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import {
  TrainingCourseFrequency,
  UserRole,
  type TrainingCourse,
} from "@prisma/client";

const ROLES: UserRole[] = [
  "PROVIDER",
  "SPECIALIST",
  "MANAGER",
  "COMMITTEE_MEMBER",
  "ADMIN",
];

const FREQUENCIES: TrainingCourseFrequency[] = [
  "ONE_TIME",
  "ANNUAL",
  "EVERY_TWO_YEARS",
  "EVERY_THREE_YEARS",
];

interface CourseRow extends TrainingCourse {
  _count: { assignments: number; records: number };
}

export function CourseTable({ courses }: { courses: CourseRow[] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-900">
          Course catalog ({courses.length})
        </h2>
        <NewCourseButton />
      </header>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Code</th>
            <th className="px-4 py-2 text-left">Title</th>
            <th className="px-4 py-2 text-left">Category</th>
            <th className="px-4 py-2 text-left">Frequency</th>
            <th className="px-4 py-2 text-left">Required for</th>
            <th className="px-4 py-2 text-right">Assigned</th>
            <th className="px-4 py-2 text-right">Records</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {courses.map((c) => (
            <CourseRow key={c.id} course={c} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CourseRow({ course }: { course: CourseRow }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className="hover:bg-gray-50 align-top">
        <td className="px-4 py-2 font-mono text-xs text-gray-700">
          {course.code}
        </td>
        <td className="px-4 py-2">
          <div className="font-medium text-gray-900">{course.title}</div>
          {course.description && (
            <div className="text-xs text-gray-500 mt-0.5">
              {course.description}
            </div>
          )}
        </td>
        <td className="px-4 py-2 capitalize">
          {course.category.replace(/_/g, " ")}
        </td>
        <td className="px-4 py-2">
          {course.frequency.replace(/_/g, " ").toLowerCase()}
        </td>
        <td className="px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {course.requiredForRoles.map((r) => (
              <span
                key={r}
                className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded"
              >
                {r}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-2 text-right">{course._count.assignments}</td>
        <td className="px-4 py-2 text-right">{course._count.records}</td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-xs text-blue-600 hover:underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 py-3">
            <CourseEditor
              course={course}
              onDone={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function NewCourseButton() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
      >
        Add course
      </button>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded p-3 w-[28rem] shadow-lg">
      <CourseEditor onDone={() => setOpen(false)} />
    </div>
  );
}

function CourseEditor({
  course,
  onDone,
}: {
  course?: CourseRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(course?.code ?? "");
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [category, setCategory] = useState(course?.category ?? "data_integrity");
  const [frequency, setFrequency] = useState<TrainingCourseFrequency>(
    course?.frequency ?? "ANNUAL"
  );
  const [contentUrl, setContentUrl] = useState(course?.contentUrl ?? "");
  const [validityDays, setValidityDays] = useState<string>(
    course?.validityDays?.toString() ?? ""
  );
  const [requiredForRoles, setRequiredForRoles] = useState<UserRole[]>(
    (course?.requiredForRoles ?? []) as UserRole[]
  );
  const [isActive, setIsActive] = useState(course?.isActive ?? true);

  const upsert = api.training.upsertCourse.useMutation({
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  const remove = api.training.deleteCourse.useMutation({
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs text-gray-600">
        Code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600 col-span-2">
        Description
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Category
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Frequency
        <select
          value={frequency}
          onChange={(e) =>
            setFrequency(e.target.value as TrainingCourseFrequency)
          }
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-gray-600">
        Validity days (overrides frequency)
        <input
          type="number"
          value={validityDays}
          onChange={(e) => setValidityDays(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Content URL
        <input
          type="url"
          value={contentUrl ?? ""}
          onChange={(e) => setContentUrl(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <div className="block text-xs text-gray-600 col-span-2">
        Required for roles
        <div className="flex flex-wrap gap-2 mt-1">
          {ROLES.map((r) => (
            <label
              key={r}
              className="text-xs flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5"
            >
              <input
                type="checkbox"
                checked={requiredForRoles.includes(r)}
                onChange={(e) => {
                  setRequiredForRoles((cur) =>
                    e.target.checked
                      ? [...cur, r]
                      : cur.filter((x) => x !== r)
                  );
                }}
              />
              {r}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700 col-span-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active (assignable)
      </label>
      {upsert.error && (
        <p className="col-span-2 text-xs text-red-600">{upsert.error.message}</p>
      )}
      <div className="col-span-2 flex justify-between">
        {course ? (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(`Delete course "${course.title}"? This will remove all assignments.`)) {
                remove.mutate({ id: course.id });
              }
            }}
            className="text-xs text-red-600 hover:underline"
          >
            {remove.isPending ? "Deleting…" : "Delete course"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-gray-600 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={upsert.isPending || !code || !title}
            onClick={() =>
              upsert.mutate({
                id: course?.id,
                code,
                title,
                description: description || null,
                category,
                frequency,
                validityDays: validityDays ? Number(validityDays) : null,
                contentUrl: contentUrl || null,
                isActive,
                requiredForRoles,
              })
            }
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : course ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
