"use client";

import { signIn } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    // Show error if redirected from NextAuth with error param
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrors({ general: "Invalid email or password. Please try again." });
    }
  }, [searchParams]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = "Email address is required.";
    else if (!/\S+@\S+\.\S+/.test(email.trim())) errs.email = "Please enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErrors({});

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.ok) {
      router.replace("/dashboard");
    } else {
      setErrors({ general: "Invalid email or password. Please try again." });
    }
  };

  const inputClass = (field: "email" | "password") =>
    `appearance-none block w-full px-3 py-2 border ${
      touched[field] && errors[field]
        ? "border-red-500"
        : "border-gray-300"
    } bg-white text-gray-900 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">ESSEN Credentialing</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Home
              </Link>
              <Link href="/auth/register" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Form */}
      <div className="flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            ESSEN Credentialing Platform
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              {/* autofill trap */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <input type="text" name="email" autoComplete="email" tabIndex={-1} />
                <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
              </div>

              <div>
                <label htmlFor="ecred-email" className="block text-sm font-medium text-gray-700">
                  Email address <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    id="ecred-email"
                    name="ecred_email"
                    type="text"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                    }}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, email: true }));
                      if (!email.trim()) setErrors((p) => ({ ...p, email: "Email address is required." }));
                    }}
                    className={inputClass("email")}
                    placeholder="you@essenmed.com"
                    ref={emailRef}
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  {touched.email && errors.email && (
                    <p className="mt-1 text-sm font-medium text-red-800">{errors.email}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="ecred-password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative">
                  <input
                    id="ecred-password"
                    name="ecred_password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, password: true }));
                      if (!password) setErrors((p) => ({ ...p, password: "Password is required." }));
                    }}
                    className={`${inputClass("password")} pr-10`}
                    placeholder="••••••••"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <p className="mt-1 text-sm font-medium text-red-800">{errors.password}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </div>

              <div className="text-center text-sm">
                <span className="text-gray-600">Don&apos;t have an account? </span>
                <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                  Register
                </Link>
              </div>
            </form>

            {/* Divider */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Essen staff</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  disabled
                  title="SSO login coming soon"
                  className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-200 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                >
                  {/* Microsoft logo. The four colors are Microsoft's
                      mandated brand asset values per the Microsoft brand
                      guidelines and may not be substituted. ADR 0015 §D3
                      explicitly carves out brand SVGs as legitimate raw-color
                      sites; opted out per-line below. */}
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    {/* eslint-disable-next-line ecred-local/no-raw-color */}
                    <rect x="1" y="1" width="8.5" height="8.5" fill="#F25022" opacity="0.4" />
                    {/* eslint-disable-next-line ecred-local/no-raw-color */}
                    <rect x="10.5" y="1" width="8.5" height="8.5" fill="#7FBA00" opacity="0.4" />
                    {/* eslint-disable-next-line ecred-local/no-raw-color */}
                    <rect x="1" y="10.5" width="8.5" height="8.5" fill="#00A4EF" opacity="0.4" />
                    {/* eslint-disable-next-line ecred-local/no-raw-color */}
                    <rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#FFB900" opacity="0.4" />
                  </svg>
                  Sign in with Microsoft (coming soon)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
