import { NextResponse, type NextRequest } from "next/server";
import {
  RedditAuthError,
  RedditBlockedError,
  RedditRateLimitError,
  getRedditCredentials,
  publicRedditFetch,
  redditFetch,
} from "@/lib/reddit/client";
import { classifyListing } from "@/lib/reddit/classify-media";
import type {
  FeedResponse,
  RedditListing,
  SortOption,
  TimeRange,
} from "@/lib/reddit/types";
import { shuffle } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_SORTS: SortOption[] = ["hot", "new", "top", "rising"];
const VALID_RANGES: TimeRange[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "all",
];
// Reddit's multi-subreddit path tolerates ~100 subs; stay conservative.
const MAX_SUBS_IN_PATH = 90;

// Default starter feed for anonymous (logged-out) users who haven't saved any
// subreddits yet. Media-heavy, SFW communities.
const DEFAULT_PUBLIC_SUBS = [
  "pics",
  "aww",
  "videos",
  "EarthPorn",
  "NatureIsFuckingLit",
  "oddlysatisfying",
  "BeAmazed",
  "interestingasfuck",
  "Damnthatsinteresting",
  "gifs",
];

/**
 * GET /api/reddit/feed
 *
 * Works for BOTH authenticated and anonymous users:
 *   - Signed in  → OAuth API; mixed mode uses the user's real subscriptions and
 *                  NSFW is honored per the `nsfw` param.
 *   - Signed out → public `.json` endpoints; mixed mode uses the `subs` param
 *                  (the user's locally-saved list) or a default starter set,
 *                  and NSFW is always off (Reddit hides it from logged-out).
 *
 * Query params: mode, subreddit, subs, sort, t, after, nsfw, shuffle.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") === "single" ? "single" : "mixed";
  const sort = (VALID_SORTS.includes(sp.get("sort") as SortOption)
    ? sp.get("sort")
    : "hot") as SortOption;
  const t = (VALID_RANGES.includes(sp.get("t") as TimeRange)
    ? sp.get("t")
    : "day") as TimeRange;
  const after = sp.get("after") ?? undefined;
  const doShuffle = sp.get("shuffle") === "1";

  try {
    const creds = await getRedditCredentials(req);
    const authed = !!creds;
    // NSFW only possible when authenticated.
    const nsfw = authed && sp.get("nsfw") === "1";

    let path: string;

    if (mode === "single") {
      const subreddit = sp.get("subreddit")?.replace(/[^a-zA-Z0-9_]/g, "");
      if (!subreddit) {
        return NextResponse.json(
          { error: "missing_subreddit" },
          { status: 400 }
        );
      }
      path = `/r/${subreddit}/${sort}`;
    } else {
      let subs = (sp.get("subs") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (subs.length === 0) {
        subs = authed
          ? await resolveUserSubreddits(req)
          : DEFAULT_PUBLIC_SUBS;
      }
      if (subs.length === 0) {
        return NextResponse.json<FeedResponse>({ posts: [], after: null });
      }
      const joined = subs.slice(0, MAX_SUBS_IN_PATH).join("+");
      path = `/r/${joined}/${sort}`;
    }

    const searchParams = {
      limit: "50",
      after,
      t: sort === "top" ? t : undefined,
    };

    const listing = (authed
      ? await redditFetch(req, path, { searchParams })
      : await publicRedditFetch(path, searchParams)) as RedditListing;

    let posts = classifyListing(listing.data.children, { nsfw });
    if (doShuffle && mode === "mixed") {
      posts = shuffle(posts);
    }

    const body: FeedResponse = {
      posts,
      after: listing.data.after,
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof RedditAuthError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof RedditRateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (err instanceof RedditBlockedError) {
      return NextResponse.json({ error: "reddit_blocked" }, { status: 502 });
    }
    console.error("[api/feed]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/** Fetch a single page of the user's subscriptions (enough for one path). */
async function resolveUserSubreddits(req: NextRequest): Promise<string[]> {
  const listing = (await redditFetch(req, "/subreddits/mine/subscriber", {
    searchParams: { limit: "100" },
  })) as RedditListing;
  return listing.data.children
    .map((c) => (c.data as unknown as { display_name: string }).display_name)
    .filter(Boolean);
}
