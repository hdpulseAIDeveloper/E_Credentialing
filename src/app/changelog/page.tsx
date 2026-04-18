/**
 * Wave 5.5 — public /changelog page.
 *
 * Server Component. Reads docs/changelog/public.md at build/runtime,
 * parses it via the pure parser in src/lib/changelog/parser.ts, and
 * renders one card per release with category badges per entry.
 *
 * SEO: each release card has a stable id (vMAJOR.MINOR.PATCH) so a
 * direct hash link goes to that release.
 */
import Link from "next/link";
import { loadPublicChangelog } from "@/lib/changelog/loader";
import {
  KNOWN_CATEGORIES,
  countByCategory,
  type ReleaseCategory,
} from "@/lib/changelog/parser";

export const metadata = {
  title: "Changelog | E-Credentialing CVO Platform",
  description:
    "Customer-facing release notes for the E-Credentialing CVO platform — features, improvements, fixes, and security updates.",
};

const CATEGORY_TONE: Record<ReleaseCategory, string> = {
  Added: "bg-blue-100 text-blue-800",
  Improved: "bg-green-100 text-green-800",
  Fixed: "bg-yellow-100 text-yellow-800",
  Security: "bg-red-100 text-red-800",
  Breaking: "bg-purple-100 text-purple-800",
  Other: "bg-gray-100 text-gray-700",
};

export default async function ChangelogPage() {
  const releases = await loadPublicChangelog();
  const counts = countByCategory(releases);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            E-Credentialing
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/cvo" className="text-gray-700 hover:text-gray-900">Why CVO</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/sandbox" className="text-gray-700 hover:text-gray-900">Sandbox</Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Changelog
            </p>
            <h1 className="mt-2 text-4xl font-extrabold text-gray-900 tracking-tight">
              What's new
            </h1>
            <p className="mt-2 text-gray-600">
              Customer-facing release notes for the platform. Engineering-internal
              changes live in the project's repository <code className="font-mono text-sm">CHANGELOG.md</code>.
            </p>
          </div>
          <Link
            href="/changelog.rss"
            className="text-sm text-blue-600 hover:text-blue-700"
            data-testid="changelog-rss-link"
          >
            Subscribe via RSS →
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {KNOWN_CATEGORIES.map((cat) => (
            <span
              key={cat}
              className={`inline-flex items-center px-2 py-1 rounded font-semibold ${CATEGORY_TONE[cat]}`}
            >
              {cat} ({counts[cat]})
            </span>
          ))}
        </div>

        <ol className="mt-12 space-y-12" data-testid="changelog-release-list">
          {releases.map((r) => (
            <li
              key={r.slug}
              id={r.slug}
              className="scroll-mt-24"
              data-testid={`changelog-release-${r.slug}`}
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap border-b border-gray-200 pb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  v{r.version}
                </h2>
                <a
                  href={`#${r.slug}`}
                  className="text-sm text-gray-500 hover:text-gray-700"
                  aria-label={`Permalink to v${r.version}`}
                >
                  {r.date}
                </a>
              </div>

              <div className="mt-4 space-y-6">
                {(Object.keys(r.groups) as ReleaseCategory[]).map((cat) => {
                  const list = r.groups[cat] ?? [];
                  if (list.length === 0) return null;
                  return (
                    <section key={cat}>
                      <h3 className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${CATEGORY_TONE[cat]}`}
                        >
                          {cat}
                        </span>
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {list.map((entry, idx) => (
                          <li
                            key={`${r.slug}-${cat}-${idx}`}
                            className="text-sm text-gray-700"
                          >
                            {/* The entry body is a single Markdown bullet — render it
                                as plain prose. We deliberately avoid pulling in a
                                Markdown library to keep the page bundle tiny;
                                inline-bold from `**…**` is rendered manually. */}
                            <RenderEntryBody markdown={entry.bodyMarkdown} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} HDPulseAI · Have a question about a
          release? Email <a className="text-blue-600 hover:text-blue-700" href="mailto:cred_onboarding@essenmed.com">cred_onboarding@essenmed.com</a>.
        </div>
      </footer>
    </div>
  );
}

/**
 * Tiny inline Markdown renderer: handles `**bold**` runs inside an
 * otherwise plain bullet line. Keeps the bundle free of a full
 * Markdown library — the changelog format is constrained on purpose.
 */
function RenderEntryBody({ markdown }: { markdown: string }) {
  const stripped = markdown.replace(/^[-*]\s+/, "");
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(stripped)) !== null) {
    if (m.index > lastIndex) {
      parts.push(stripped.slice(lastIndex, m.index));
    }
    parts.push(
      <strong key={`b${key++}`} className="font-semibold text-gray-900">
        {m[1]}
      </strong>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < stripped.length) {
    parts.push(stripped.slice(lastIndex));
  }
  return <>{parts}</>;
}
