import "server-only";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { refreshRedditToken, REDDIT_USER_AGENT } from "@/lib/auth";
import {
  getUserByRedditId,
  isDbConfigured,
  updateTokens,
} from "@/lib/db";

const OAUTH_BASE = "https://oauth.reddit.com";
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh when <5min remaining

interface RedditCredentials {
  redditId: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Resolve a live, non-expired Reddit access token for the current request.
 *
 * Source of truth is Supabase (when configured); otherwise the values seeded
 * into the Auth.js JWT are used. Either way we refresh proactively so callers
 * never hit a mid-scroll 401.
 */
export async function getRedditCredentials(
  req: NextRequest
): Promise<RedditCredentials | null> {
  const jwt = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });
  if (!jwt?.redditId) return null;

  const redditId = jwt.redditId as string;
  const username = (jwt.username as string) ?? "";

  let accessToken = jwt.accessToken as string;
  let refreshToken = jwt.refreshToken as string;
  let expiresAt = (jwt.expiresAt as number) ?? 0;

  // Prefer DB-stored tokens (they survive across devices / refreshes).
  if (isDbConfigured()) {
    const stored = await getUserByRedditId(redditId);
    if (stored) {
      accessToken = stored.accessToken;
      refreshToken = stored.refreshToken;
      expiresAt = stored.tokenExpiresAt;
    }
  }

  if (!accessToken || !refreshToken) return null;

  // Proactive refresh.
  if (Date.now() >= expiresAt - REFRESH_THRESHOLD_MS) {
    try {
      const refreshed = await refreshRedditToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresAt = refreshed.expiresAt;
      if (isDbConfigured()) {
        await updateTokens(redditId, {
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresAt,
        });
      }
    } catch (err) {
      console.error("[reddit] proactive refresh failed", err);
      // Fall through with the (possibly stale) token; one retry on 401 below.
    }
  }

  return { redditId, username, accessToken, refreshToken, expiresAt };
}

/**
 * Authenticated GET against the Reddit OAuth API. Retries once on a 401 by
 * forcing a token refresh.
 */
export async function redditFetch(
  req: NextRequest,
  path: string,
  init?: { searchParams?: Record<string, string | undefined> }
): Promise<unknown> {
  const creds = await getRedditCredentials(req);
  if (!creds) throw new RedditAuthError("Not authenticated");

  const doFetch = async (token: string) => {
    const url = new URL(path.startsWith("http") ? path : `${OAUTH_BASE}${path}`);
    if (init?.searchParams) {
      for (const [k, v] of Object.entries(init.searchParams)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
      }
    }
    // raw_json=1 stops Reddit from HTML-encoding URLs in the payload.
    url.searchParams.set("raw_json", "1");
    return fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": REDDIT_USER_AGENT,
      },
      cache: "no-store",
    });
  };

  let res = await doFetch(creds.accessToken);

  if (res.status === 401) {
    // Forced refresh + single retry.
    try {
      const refreshed = await refreshRedditToken(creds.refreshToken);
      if (isDbConfigured()) {
        await updateTokens(creds.redditId, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
      }
      res = await doFetch(refreshed.accessToken);
    } catch (err) {
      throw new RedditAuthError("Token refresh failed");
    }
  }

  if (res.status === 429) {
    throw new RedditRateLimitError();
  }
  if (!res.ok) {
    throw new Error(`Reddit API error ${res.status} for ${path}`);
  }
  return res.json();
}

export class RedditAuthError extends Error {}
export class RedditRateLimitError extends Error {
  constructor() {
    super("Reddit rate limit exceeded");
  }
}
/** Reddit refused an unauthenticated request (typically a datacenter-IP block). */
export class RedditBlockedError extends Error {
  constructor() {
    super("Reddit blocked the request (no app credentials for guest browsing)");
  }
}

const PUBLIC_BASE = "https://www.reddit.com";

// Cached application-only token (client_credentials grant) for guest browsing.
let appTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Obtain (and cache) an application-only OAuth token via the client_credentials
 * grant. This authenticates the *app itself* — no user login — and lets guest
 * browsing hit `oauth.reddit.com`, which (unlike the public `.json` host) is
 * not blocked for datacenter IPs. Returns null if app credentials aren't set.
 */
async function getAppOnlyToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (appTokenCache && Date.now() < appTokenCache.expiresAt - 60_000) {
    return appTokenCache.token;
  }

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[reddit] app-only token request failed", res.status);
    return null;
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return appTokenCache.token;
}

/**
 * GET against Reddit for guest (no user login) browsing.
 *
 * Prefers an application-only OAuth token against `oauth.reddit.com` — this is
 * the only path that works from a deployed/datacenter host, and it needs just
 * the app's client id/secret (no user auth). Falls back to the public `.json`
 * host when no credentials are configured (fine for local dev on a residential
 * IP, but blocked with 403 from cloud IPs).
 *
 * `path` must be given WITHOUT a `.json` suffix (e.g. `/r/pics/hot`).
 */
export async function publicRedditFetch(
  path: string,
  searchParams?: Record<string, string | undefined>
): Promise<unknown> {
  const token = await getAppOnlyToken();

  const base = token ? OAUTH_BASE : PUBLIC_BASE;
  const suffix = token ? "" : ".json";
  const url = new URL(`${base}${path}${suffix}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }
  url.searchParams.set("raw_json", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": REDDIT_USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Cache public listings briefly to cut request volume against Reddit.
    next: { revalidate: 60 },
  });

  if (res.status === 429) throw new RedditRateLimitError();
  if (res.status === 403) {
    // Almost always the datacenter-IP block on the unauthenticated host.
    throw new RedditBlockedError();
  }
  if (!res.ok) {
    throw new Error(`Reddit public API error ${res.status} for ${path}`);
  }
  return res.json();
}
