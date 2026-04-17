/**
 * Peer Review Committee dashboard — Joint Commission NPG 12.
 *
 * Lists scheduled and recent peer-review meetings with attendee count,
 * minute count, and a link into per-meeting detail.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { CreateMeetingButton } from "./CreateMeetingButton";

const MEETING_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function PeerReviewPage() {
  const meetings = await db.peerReviewMeeting.findMany({
    include: {
      chair: { select: { id: true, displayName: true } },
      _count: { select: { minutes: true } },
    },
    orderBy: { meetingDate: "desc" },
    take: 100,
  });

  const upcoming = meetings.filter(
    (m) => m.meetingDate.getTime() >= Date.now() - 24 * 60 * 60 * 1000
  );
  const past = meetings.filter(
    (m) => m.meetingDate.getTime() < Date.now() - 24 * 60 * 60 * 1000
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Peer Review Committee
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Joint Commission NPG 12 — peer-review meeting minutes, case
            outcomes, and FPPE follow-up actions.
          </p>
        </div>
        <CreateMeetingButton />
      </div>

      <Section title={`Upcoming & in-progress (${upcoming.length})`}>
        <MeetingList meetings={upcoming} fmt={fmtDateTime} />
      </Section>

      <Section title={`Past meetings (${past.length})`}>
        <MeetingList meetings={past} fmt={fmtDateTime} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <header className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}

interface MeetingRow {
  id: string;
  meetingDate: Date;
  facilityName: string | null;
  status: string;
  chair: { id: string; displayName: string | null } | null;
  _count: { minutes: number };
}

function MeetingList({
  meetings,
  fmt,
}: {
  meetings: MeetingRow[];
  fmt: (d: Date) => string;
}) {
  if (meetings.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500">No meetings to display.</p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
        <tr>
          <th className="px-4 py-2 text-left">Date</th>
          <th className="px-4 py-2 text-left">Facility</th>
          <th className="px-4 py-2 text-left">Chair</th>
          <th className="px-4 py-2 text-left">Status</th>
          <th className="px-4 py-2 text-right">Cases</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {meetings.map((m) => (
          <tr key={m.id} className="hover:bg-gray-50">
            <td className="px-4 py-2">
              <Link
                href={`/peer-review/${m.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {fmt(m.meetingDate)}
              </Link>
            </td>
            <td className="px-4 py-2 text-gray-700">
              {m.facilityName ?? "—"}
            </td>
            <td className="px-4 py-2 text-gray-700">
              {m.chair?.displayName ?? "—"}
            </td>
            <td className="px-4 py-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  MEETING_STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {m.status}
              </span>
            </td>
            <td className="px-4 py-2 text-right text-gray-700">
              {m._count.minutes}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
