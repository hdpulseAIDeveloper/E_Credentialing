import Link from "next/link";
import {
  LEGAL_COPY_LAST_REVIEWED_AT,
  LEGAL_COPY_STATUS,
  LEGAL_COPY_VERSION,
  LEGAL_FOOTER_LINKS,
} from "@/lib/legal/copy";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg
                aria-hidden
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">
              ESSEN Credentialing
            </span>
          </Link>
          <nav aria-label="Legal documents" className="hidden gap-4 text-sm sm:flex">
            {LEGAL_FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-blue-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>

      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-6 text-center text-xs text-gray-500 sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} Essen Medical Associates. All rights reserved.
          </p>
          <p>
            Legal copy bundle <span className="font-mono">{LEGAL_COPY_VERSION}</span>{" "}
            ({LEGAL_COPY_STATUS}) — last reviewed {LEGAL_COPY_LAST_REVIEWED_AT}.
          </p>
          <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 sm:hidden">
            {LEGAL_FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-blue-700"
              >
                {link.label}
              </Link>
            ))}
          </p>
        </div>
      </footer>
    </div>
  );
}
