// auth.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

function isAllowedEmail(email: string | null | undefined) {
  const configured = process.env.ALLOWED_EMAILS?.trim();
  if (!configured) return true;

  const allowedEmails = new Set(
    configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  return Boolean(email && allowedEmails.has(email.toLowerCase()));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    // Runs on sign-in. Return true to allow, false to block.
    signIn({ user }) {
      const allowed = isAllowedEmail(user.email);
      if (!allowed && process.env.NODE_ENV !== "production") {
        // Helps debug ALLOWED_EMAILS locally; never logged in production.
        console.warn(
          `[auth] Sign-in blocked by ALLOWED_EMAILS: ${user.email ?? "(no email)"}`,
        );
      }
      return allowed;
    },

    // Runs on every auth() call. Adds the user id to what auth() returns.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
