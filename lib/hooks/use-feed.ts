"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  FeedMode,
  FeedPost,
  FeedResponse,
  SortOption,
  TimeRange,
} from "@/lib/reddit/types";

export interface FeedParams {
  mode: FeedMode;
  subreddit?: string; // required when mode === "single"
  sort: SortOption;
  timeRange: TimeRange;
  nsfw: boolean;
  shuffle: boolean;
}

async function fetchFeedPage(
  params: FeedParams,
  after: string | null
): Promise<FeedResponse> {
  const sp = new URLSearchParams();
  sp.set("mode", params.mode);
  sp.set("sort", params.sort);
  if (params.sort === "top") sp.set("t", params.timeRange);
  if (params.mode === "single" && params.subreddit) {
    sp.set("subreddit", params.subreddit);
  }
  if (params.nsfw) sp.set("nsfw", "1");
  if (params.shuffle) sp.set("shuffle", "1");
  if (after) sp.set("after", after);

  const res = await fetch(`/api/reddit/feed?${sp.toString()}`);
  if (res.status === 401) {
    throw new Error("unauthenticated");
  }
  if (!res.ok) {
    throw new Error(`feed request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Infinite feed query. Returns a flat list of displayable posts plus the
 * standard TanStack Query pagination controls.
 */
export function useFeed(params: FeedParams) {
  const query = useInfiniteQuery({
    queryKey: [
      "feed",
      params.mode,
      params.subreddit ?? "",
      params.sort,
      params.sort === "top" ? params.timeRange : "",
      params.nsfw,
      params.shuffle,
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchFeedPage(params, pageParam),
    getNextPageParam: (lastPage) => lastPage.after ?? undefined,
  });

  const posts: FeedPost[] = query.data?.pages.flatMap((p) => p.posts) ?? [];

  return { ...query, posts };
}
