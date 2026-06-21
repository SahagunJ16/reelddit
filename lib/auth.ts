import NextAuth, { type NextAuthConfig } from "next-auth";
import { upsertUser } from "./db";

const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || "web:reelddit:0.1.0 (by /u/unknown)";

const SCOPES = ["identity", "read", "mysubreddits"].join(" ");

/** Refresh an expired Reddit access token using the refresh_token grant. */
async function refreshRedditToken(refreshToken: string) {
  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Reddit token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    // Reddit may or may not rotate the refresh token; keep the old one if not.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    {
      id: "reddit",
      name: "Reddit",
      type: "oauth",
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      authorization: {
        url: "https://www.reddit.com/api/v1/authorize",
        params: {
          scope: SCOPES,
          duration: "permanent", // request a refresh token
          response_type: "code",
        },
      },
      token: {
        url: "https://www.reddit.com/api/v1/access_token",
        // Reddit requires HTTP Basic auth (client_id:secret) on token exchange.
        async request({
          params,
          provider,
        }: {
          params: { code?: string };
          provider: { clientId?: string; clientSecret?: string; callbackUrl?: string };
        }) {
          const basic = Buffer.from(
            `${provider.clientId}:${provider.clientSecret}`
          ).toString("base64");
          const res = await fetch(
            "https://www.reddit.com/api/v1/access_token",
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": REDDIT_USER_AGENT,
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                code: String(params.code),
                redirect_uri: String(provider.callbackUrl ?? ""),
              }),
            }
          );
          const tokens = await res.json();
          return { tokens };
        },
      },
      userinfo: {
        url: "https://oauth.reddit.com/api/v1/me",
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const res = await fetch("https://oauth.reddit.com/api/v1/me", {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "User-Agent": REDDIT_USER_AGENT,
            },
          });
          return res.json();
        },
      },
      profile(profile: {
        id: string;
        name: string;
        icon_img?: string;
        snoovatar_img?: string;
      }) {
        const avatar =
          profile.snoovatar_img || profile.icon_img?.split("?")[0] || null;
        return {
          id: profile.id,
          name: profile.name,
          image: avatar,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in: capture tokens + reddit identity.
      if (account && profile) {
        const redditProfile = profile as {
          id: string;
          name: string;
          icon_img?: string;
          snoovatar_img?: string;
        };
        token.redditId = redditProfile.id;
        token.username = redditProfile.name;
        token.avatarUrl =
          redditProfile.snoovatar_img ||
          redditProfile.icon_img?.split("?")[0] ||
          null;
        token.accessToken = account.access_token as string;
        token.refreshToken = account.refresh_token as string;
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;

        // Persist encrypted tokens (best-effort; DB is optional in dev).
        try {
          await upsertUser({
            redditId: token.redditId as string,
            username: token.username as string,
            avatarUrl: token.avatarUrl as string | null,
            accessToken: token.accessToken as string,
            refreshToken: token.refreshToken as string,
            tokenExpiresAt: token.expiresAt as number,
          });
        } catch (err) {
          console.error("[auth] failed to persist user", err);
        }
        return token;
      }

      // Proactively refresh if within 5 minutes of expiry.
      const expiresAt = (token.expiresAt as number) ?? 0;
      if (Date.now() < expiresAt - 5 * 60 * 1000) {
        return token;
      }

      try {
        const refreshed = await refreshRedditToken(
          token.refreshToken as string
        );
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.expiresAt = refreshed.expiresAt;
        try {
          await upsertUser({
            redditId: token.redditId as string,
            username: token.username as string,
            avatarUrl: token.avatarUrl as string | null,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: refreshed.expiresAt,
          });
        } catch (err) {
          console.error("[auth] failed to persist refreshed tokens", err);
        }
      } catch (err) {
        console.error("[auth] token refresh failed", err);
        token.error = "RefreshTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        name: (token.username as string) ?? session.user?.name,
        image: (token.avatarUrl as string | null) ?? session.user?.image,
      };
      (session as { redditId?: string }).redditId = token.redditId as string;
      (session as { error?: string }).error = token.error as string | undefined;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { refreshRedditToken, REDDIT_USER_AGENT };
