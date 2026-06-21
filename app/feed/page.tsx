import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";

/** Mixed feed: interleaved media across the user's joined subreddits. */
export default async function FeedPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <FeedView />;
}
