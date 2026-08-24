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
    signIn({ user }) {
      return isAllowedEmail(user.email);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
