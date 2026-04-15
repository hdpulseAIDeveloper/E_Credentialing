"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ESSEN Credentialing</h1>
          <p className="text-gray-500 mt-2">Sign in to access the credentialing platform</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="8.5" height="8.5" fill="#F25022"/>
                <rect x="10.5" y="1" width="8.5" height="8.5" fill="#7FBA00"/>
                <rect x="1" y="10.5" width="8.5" height="8.5" fill="#00A4EF"/>
                <rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-6">
          Staff only — use your Essen Medical Azure AD account.
          <br />
          Provider applicants access the platform via the invite link in your email.
        </p>
      </div>
    </div>
  );
}
