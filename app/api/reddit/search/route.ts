import { NextResponse, type NextRequest } from "next/server";
import {
  RedditAuthError,
  RedditRateLimitError,
  redditFetch,
} from "@/lib/reddit/client";
import type { SubredditInfo } from "@/lib/reddit/types";
import { decodeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/reddit/search?q=<query>
 * Subreddit-name autocomplete (no user/post search — out of scope).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ subreddits: [] });
  }

  try {
    const data = (await redditFetch(req, "/api/subreddit_autocomplete_v2", {
      searchParams: {
        query: q,
        limit: "10",
        include_over_18: "true",
        include_profiles: "false",
        typeahead_active: "true",
      },
    })) as {
      data: {
        children: {
          data: {
            display_name: string;
            display_name_prefixed: string;
            title: string;
            community_icon?: string;
            icon_img?: string;
            subscribers?: number;
            over18?: boolean;
          };
        }[];
      };
    };

    const subreddits: SubredditInfo[] = data.data.children.map((c) => {
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
    console.error("[api/search]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
