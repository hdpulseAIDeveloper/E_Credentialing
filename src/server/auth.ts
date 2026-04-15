/**
 * Auth.js v5 configuration.
 * - Staff: Microsoft Entra ID (Azure AD) SSO
 * - Providers: Magic Link JWT token validation (Credentials provider)
 */

import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db";
import type { UserRole } from "@prisma/client";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// Extend next-auth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      providerId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    providerId?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },

  providers: [
    // ─── Staff SSO via Microsoft Entra ID (Azure AD) ───────────────────────
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
      // Note: AZURE_AD_CLIENT_SECRET is validated in src/env.ts
      authorization: {
        params: {
          scope: "openid profile email",
          tenant: process.env.AZURE_AD_TENANT_ID!,
        },
      },
    }),

    // ─── Email / Password credentials ────────────────────────────────────
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),

    // ─── Provider Magic Link token validation ─────────────────────────────
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        try {
          const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
          const { payload } = await jwtVerify(credentials.token as string, secret);

          const providerId = payload.providerId as string;
          const email = payload.email as string;

          // Look up or create user linked to provider
          const user = await db.user.findFirst({
            where: {
              OR: [{ email }, { providerId }],
            },
          });

          if (!user || !user.isActive) return null;

          // Update last login
          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    // ─── JWT callback: embed role + userId into token ─────────────────────
    async jwt({ token, account, profile, user }) {
      // ── Credentials sign-in (email/password or magic-link) ────────────
      if (account?.type === "credentials" && user?.id) {
        const dbUser = await db.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.providerId = dbUser.providerId;
        }
        return token;
      }

      // ── Azure AD first sign-in ─────────────────────────────────────────
      if (account && profile) {
        const oid = (profile as { oid?: string }).oid;
        const email = profile.email ?? token.email;

        if (email) {
          const dbUser = await db.user.upsert({
            where: { email },
            update: {
              azureAdOid: oid ?? undefined,
              lastLoginAt: new Date(),
              displayName: (profile.name ?? token.name ?? email) as string,
            },
            create: {
              email,
              displayName: (profile.name ?? email) as string,
              azureAdOid: oid ?? null,
              role: "SPECIALIST", // Default role — Admin can elevate
              isActive: true,
              lastLoginAt: new Date(),
            },
          });

          token.id = dbUser.id;
          token.role = dbUser.role;
          token.providerId = dbUser.providerId;
        }
      }

      // ── Refresh role on subsequent requests ───────────────────────────
      if (token.id && !token.role) {
        const dbUser = await db.user.findUnique({ where: { id: token.id } });
        if (dbUser) {
          token.role = dbUser.role;
          token.providerId = dbUser.providerId;
        }
      }

      return token;
    },

    // ─── Session callback: expose role and userId to client ───────────────
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.providerId = token.providerId;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
