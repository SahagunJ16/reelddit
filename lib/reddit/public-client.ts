import { classifyListing } from "./classify-media";
import type {
  FeedResponse,
  RedditListing,
  SortOption,
  SubredditInfo,
  TimeRange,
} from "./types";
import { decodeHtml, shuffle } from "@/lib/utils";

/**
 * Browser-side Reddit access for GUEST (logged-out) browsing.
 *
 * These requests run in the user's browser against Reddit's public `.json`
 * host, so they originate from the user's residential IP — which dodges the
 * 403 datacenter-IP block that hits server-side (Vercel) fetches, and needs no
 * OAuth app / approval. Reddit serves `Access-Control-Allow-Origin: *` on these
 * GETs, so CORS permits it (may be blocked by aggressive browser tracking
 * protection; see README).
 *
 * Limitations (same as any logged-out access): no NSFW, no user subscriptions.
 */

const PUBLIC_BASE = "https://www.reddit.com";

// Default starter feed for guests with no saved subreddits. Keep in sync with
// the server route's list.
export const DEFAULT_PUBLIC_SUBS = [
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

export interface PublicFeedArgs {
  mode: "mixed" | "single";
  subreddit?: string;
  subs?: string[];
  sort: SortOption;
  timeRange: TimeRange;
  shuffle: boolean;
}

function buildUrl(
  path: string,
  params: Record<string, string | undefined>
): string {
  const url = new URL(`${PUBLIC_BASE}${path}.json`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("raw_json", "1");
  return url.toString();
}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // Network/CORS failure (e.g. Safari cross-site tracking prevention).
    throw new Error("reddit_unreachable");
  }
  if (res.status === 403) throw new Error("reddit_blocked");
  if (res.status === 429) throw new Error("rate_limited");
  if (!res.ok) throw new Error(`reddit_error_${res.status}`);
  return res.json();
}

/** Fetch one page of the guest feed directly from the browser. */
export async function fetchPublicFeed(
  args: PublicFeedArgs,
  after: string | null
): Promise<FeedResponse> {
  let path: string;
  if (args.mode === "single") {
    const sub = (args.subreddit ?? "").replace(/[^a-zA-Z0-9_]/g, "");
    path = `/r/${sub}/${args.sort}`;
  } else {
    const subs =
      args.subs && args.subs.length > 0 ? args.subs : DEFAULT_PUBLIC_SUBS;
    path = `/r/${subs.slice(0, 90).join("+")}/${args.sort}`;
  }

  const listing = (await getJson(
    buildUrl(path, {
      limit: "50",
      after: after ?? undefined,
      t: args.sort === "top" ? args.timeRange : undefined,
    })
  )) as RedditListing;

  let posts = classifyListing(listing.data.children, { nsfw: false });
  if (args.shuffle && args.mode === "mixed") posts = shuffle(posts);

  return { posts, after: listing.data.after };
}

/** Subreddit-name search directly from the browser (guest). */
export async function fetchPublicSearch(q: string): Promise<SubredditInfo[]> {
  const data = (await getJson(
    buildUrl("/subreddits/search", {
      q,
      limit: "10",
      include_over_18: "false",
    })
  )) as {
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

  return data.data.children.map((c) => {
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
}
