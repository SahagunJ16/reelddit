import { NextResponse, type NextRequest } from "next/server";
import {
  RedditAuthError,
  RedditBlockedError,
  RedditRateLimitError,
  getRedditCredentials,
  publicRedditFetch,
  redditFetch,
} from "@/lib/reddit/client";
import type { SubredditInfo } from "@/lib/reddit/types";
import { decodeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SubredditChild {
  data: {
    display_name: string;
    display_name_prefixed: string;
    title: string;
    community_icon?: string;
    icon_img?: string;
    subscribers?: number;
    over18?: boolean;
  };
}

/**
 * GET /api/reddit/search?q=<query>
 * Subreddit-name search. Uses the OAuth autocomplete endpoint when signed in,
 * and falls back to the public `subreddits/search.json` endpoint for guests.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ subreddits: [] });
  }

  try {
    const creds = await getRedditCredentials(req);

    let children: SubredditChild[];
    if (creds) {
      const data = (await redditFetch(
        req,
        "/api/subreddit_autocomplete_v2",
        {
          searchParams: {
            query: q,
            limit: "10",
            include_over_18: "true",
            include_profiles: "false",
            typeahead_active: "true",
          },
        }
      )) as { data: { children: SubredditChild[] } };
      children = data.data.children;
    } else {
      const data = (await publicRedditFetch("/subreddits/search", {
        q,
        limit: "10",
        include_over_18: "false",
      })) as { data: { children: SubredditChild[] } };
      children = data.data.children;
    }

    const subreddits: SubredditInfo[] = children.map((c) => {
      const d = c.data;
      return {
        name: d.display_name.toLowerCase(),
        displayName: d.display_name,
        prefixed: d.display_name_prefixed,
        title: d.title ?? "",
        iconUrl:
          decodeHtml(d.community_icon || "")?.split("?")[0] ||
          d.icon_img?.split("?")[0] ||
          null,
        subscribers: d.subscribers ?? 0,
        over18: !!d.over18,
      };
    });

    return NextResponse.json({ subreddits });
  } catch (err) {
    if (err instanceof RedditAuthError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (err instanceof RedditRateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    if (err instanceof RedditBlockedError) {
      // Guest search needs app credentials in production; degrade quietly.
      return NextResponse.json({ subreddits: [] });
    }
    console.error("[api/search]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
