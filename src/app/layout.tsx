import type { Metadata } from "next";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "ESSEN Credentialing Platform",
  description: "Healthcare provider credentialing and onboarding for Essen Medical",
};

// System font stack keeps builds offline-safe (no fonts.gstatic.com round-trip)
// and still renders crisp, platform-native typography on every major OS.
const SYSTEM_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", ' +
  'Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, ' +
  '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: SYSTEM_FONT_STACK }}>
        <TRPCReactProvider>
          {children}
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
