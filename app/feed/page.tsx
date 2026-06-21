import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";

/**
 * Mixed feed. Open to everyone:
 *   - guests get a public feed from their saved subreddits (or a default set);
 *   - signed-in users get their joined subreddits.
 */
export default function FeedPage() {
  return <FeedView />;
}
