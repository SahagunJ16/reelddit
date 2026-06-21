"use client";

import { useSession } from "next-auth/react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { FeedContainer } from "./FeedContainer";
import { TopNav } from "@/components/layout/TopNav";
import type { FeedParams } from "@/lib/hooks/use-feed";

/**
 * Wires the persisted filter store into feed params and renders the feed plus
 * its navigation overlay. Used by both the mixed (/feed) and single
 * (/r/[subreddit]) routes, for authenticated and guest users alike.
 *
 * - Signed in  → mixed mode uses the user's real subscriptions (server-side).
 * - Signed out → mixed mode uses the locally-saved subreddit list (or a default
 *                starter set when none are saved).
 */
export function FeedView({ subreddit }: { subreddit?: string }) {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const sort = useFeedStore((s) => s.sort);
  const timeRange = useFeedStore((s) => s.timeRange);
  const nsfw = useFeedStore((s) => s.nsfw);
  const shuffle = useFeedStore((s) => s.shuffle);
  const savedSubreddits = useFeedStore((s) => s.savedSubreddits);

  const mode = subreddit ? "single" : "mixed";

  // Only guests drive the feed from their saved list; signed-in users get their
  // real subscriptions resolved server-side.
  const subs = !authenticated && mode === "mixed" ? savedSubreddits : undefined;

  const params: FeedParams = {
    mode,
    subreddit,
    subs,
    sort,
    timeRange,
    nsfw: authenticated ? nsfw : false,
    shuffle,
  };

  const feedKey = [
    mode,
    subreddit ?? "home",
    subs ? subs.join("+") : "subs",
    sort,
    sort === "top" ? timeRange : "",
    authenticated && nsfw ? "nsfw" : "",
  ].join(":");

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <TopNav
        mode={mode}
        subtitle={subreddit ? `r/${subreddit}` : undefined}
        authenticated={authenticated}
      />
      <FeedContainer params={params} feedKey={feedKey} />
    </main>
  );
}
