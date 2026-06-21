import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";

/** Single-subreddit feed. Public subreddits work without signing in. */
export default function SubredditPage({
  params,
}: {
  params: { subreddit: string };
}) {
  const subreddit = params.subreddit.replace(/[^a-zA-Z0-9_]/g, "");
  return <FeedView subreddit={subreddit} />;
}
