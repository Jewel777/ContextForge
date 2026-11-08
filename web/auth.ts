import type { DefaultSession, NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const githubConfigured = Boolean(
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
);

export const authConfigured = githubConfigured;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "contextforge-local-beta-2.1.1",

  providers: githubConfigured
    ? [
        GithubProvider({
          clientId: process.env.AUTH_GITHUB_ID!,
          clientSecret: process.env.AUTH_GITHUB_SECRET!,
        }),
      ]
    : [],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          token.sub ??
          session.user.email ??
          session.user.name ??
          "authenticated-user";
      }

      return session;
    },
  },
};
