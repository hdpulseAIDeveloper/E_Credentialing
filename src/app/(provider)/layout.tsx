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
      <footer className="border-t mt-12 py-6 text-center text-sm text-gray-400">
        © Essen Medical Associates · Credentialing Department · cred_onboarding@essenmed.com
      </footer>
    </div>
  );
}
