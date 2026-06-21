import type { DefaultSession } from "next-auth";

// Extend Auth.js types with the Reddit-specific fields we store on the JWT and
// surface (minimally) on the session.

declare module "next-auth" {
  interface Session {
    redditId?: string;
    error?: string;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    redditId?: string;
    username?: string;
    avatarUrl?: string | null;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
