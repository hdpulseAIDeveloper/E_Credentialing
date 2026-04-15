/**
 * Lightweight auth config for edge middleware.
 * Does NOT import Prisma or bcrypt — only JWT session validation.
 * The full auth config (with adapter, callbacks, DB lookups) stays in auth.ts.
 */

import NextAuth from "next-auth";

export const { auth: authMiddleware } = NextAuth({
  session: { strategy: "jwt" },
  providers: [],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
});
