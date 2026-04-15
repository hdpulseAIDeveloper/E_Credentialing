"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className ?? "px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"}
    >
      Sign Out
    </button>
  );
}
