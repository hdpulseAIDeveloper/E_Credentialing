"use client";

import Link from "next/link";

interface Props {
  enrollmentId: string;
}

export function MedicaidRowActions({ enrollmentId }: Props) {
  return (
    <Link href={`/medicaid/${enrollmentId}`} className="text-blue-600 hover:underline text-sm">
      View
    </Link>
  );
}
