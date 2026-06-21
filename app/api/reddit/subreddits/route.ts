import { NextResponse, type NextRequest } from "next/server";
import {
  RedditAuthError,
  RedditRateLimitError,
  redditFetch,
} from "@/lib/reddit/client";
import type { RedditListing, SubredditInfo } from "@/lib/reddit/types";
import { decodeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/reddit/subreddits
 * Returns the list of subreddits the signed-in user is subscribed to.
 * Paginates Reddit's `/subreddits/mine/subscriber` internally (up to ~5 pages).
 */
export async function GET(req: NextRequest) {
  try {
    const subs: SubredditInfo[] = [];
    let after: string | null = null;
    let pages = 0;

    do {
      const listing = (await redditFetch(req, "/subreddits/mine/subscriber", {
        searchParams: { limit: "100", after: after ?? undefined },
      })) as RedditListing;

      for (const child of listing.data.children) {
        const d = child.data as unknown as {
          display_name: string;
          display_name_prefixed: string;
          title: string;
          community_icon?: string;
          icon_img?: string;
          subscribers?: number;
          over18?: boolean;
        };
        subs.push({
          name: d.display_name.toLowerCase(),
          displayName: d.display_name,
          prefixed: d.display_name_prefixed,
          title: d.title,
          iconUrl:
            decodeHtml(d.community_icon || "")?.split("?")[0] ||
            d.icon_img?.split("?")[0] ||
            null,
          subscribers: d.subscribers ?? 0,
          over18: !!d.over18,
        });
      }

      after = listing.data.after;
      pages += 1;
    } while (after && pages < 5);

    subs.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ subreddits: subs });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof RedditAuthError) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (err instanceof RedditRateLimitError) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  console.error("[api/subreddits]", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
