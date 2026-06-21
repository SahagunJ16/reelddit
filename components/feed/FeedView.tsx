"use client";

import { useFeedStore } from "@/lib/stores/feed-store";
import { FeedContainer } from "./FeedContainer";
import { TopNav } from "@/components/layout/TopNav";
import type { FeedParams } from "@/lib/hooks/use-feed";

/**
 * Wires the persisted filter store into feed params and renders the feed plus
 * its navigation overlay. Used by both the mixed (/feed) and single
 * (/r/[subreddit]) routes. Requires an authenticated session (enforced by the
 * pages); the server resolves the user's subscriptions for the mixed feed.
 */
export function FeedView({ subreddit }: { subreddit?: string }) {
  const sort = useFeedStore((s) => s.sort);
  const timeRange = useFeedStore((s) => s.timeRange);
  const nsfw = useFeedStore((s) => s.nsfw);
  const shuffle = useFeedStore((s) => s.shuffle);

  const mode = subreddit ? "single" : "mixed";

  const params: FeedParams = {
    mode,
    subreddit,
    sort,
    timeRange,
    nsfw,
    shuffle,
  };

  const feedKey = [
    mode,
    subreddit ?? "home",
    sort,
    sort === "top" ? timeRange : "",
    nsfw ? "nsfw" : "",
  ].join(":");

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <TopNav mode={mode} subtitle={subreddit ? `r/${subreddit}` : undefined} />
      <FeedContainer params={params} feedKey={feedKey} />
    </main>
  );
}
