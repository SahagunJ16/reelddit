import { NextResponse, type NextRequest } from "next/server";
import {
  RedditAuthError,
  RedditRateLimitError,
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

/**
 * GET /api/reddit/feed
 *
 * Query params:
 *   mode       "mixed" | "single"        (default mixed)
 *   subreddit  required when mode=single
 *   subs       comma-separated list for mixed mode (optional; otherwise the
 *              server resolves the user's subscriptions)
 *   sort       hot|new|top|rising        (default hot)
 *   t          hour|day|week|month|year|all (for sort=top, default day)
 *   after      Reddit pagination cursor
 *   nsfw       "1" to include over_18 posts
 *   shuffle    "1" to shuffle the returned batch (mixed mode)
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
  const nsfw = sp.get("nsfw") === "1";
  const doShuffle = sp.get("shuffle") === "1";

  try {
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
        subs = await resolveUserSubreddits(req);
      }
      if (subs.length === 0) {
        return NextResponse.json<FeedResponse>({ posts: [], after: null });
      }
      const joined = subs.slice(0, MAX_SUBS_IN_PATH).join("+");
      path = `/r/${joined}/${sort}`;
    }

    const listing = (await redditFetch(req, path, {
      searchParams: {
        limit: "50",
        after,
        t: sort === "top" ? t : undefined,
      },
    })) as RedditListing;

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
