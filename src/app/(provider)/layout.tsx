import Link from "next/link";
import { AiChatLauncher } from "@/components/ai/AiChatLauncher";
import { LEGAL_FOOTER_LINKS } from "@/lib/legal/copy";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">Essen Medical — Provider Credentialing</h1>
          <span className="text-sm text-gray-500">Secure Application Portal</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
      <footer className="border-t mt-12 py-6">
        <div className="max-w-4xl mx-auto px-6 space-y-2 text-center text-sm text-gray-500">
          <p>
            &copy; Essen Medical Associates · Credentialing Department ·{" "}
            <a
              href="mailto:cred_onboarding@essenmed.com"
              className="text-blue-700 hover:underline"
            >
              cred_onboarding@essenmed.com
            </a>
          </p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {LEGAL_FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-blue-700"
                target="_blank"
                rel="noopener"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      {/* P1 Gap #11 — provider self-service AI assistant */}
      <AiChatLauncher mode="PROVIDER" />
    </div>
  );
}
