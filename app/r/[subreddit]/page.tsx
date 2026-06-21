import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";

/** Single-subreddit feed. */
export default async function SubredditPage({
  params,
}: {
  params: { subreddit: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const subreddit = params.subreddit.replace(/[^a-zA-Z0-9_]/g, "");
  return <FeedView subreddit={subreddit} />;
}
