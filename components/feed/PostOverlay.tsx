"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigUp,
  ExternalLink,
  MessageSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { FeedPost } from "@/lib/reddit/types";
import { useFeedStore } from "@/lib/stores/feed-store";
import { Badge } from "@/components/ui/badge";
import { formatCount, timeAgo } from "@/lib/utils";

/**
 * The text/info layer over each post: subreddit, author, title, flair, age,
 * read-only upvote count, mute toggle, and an "open in Reddit" link.
 */
export function PostOverlay({ post }: { post: FeedPost }) {
  const muted = useFeedStore((s) => s.muted);
  const toggleMuted = useFeedStore((s) => s.toggleMuted);
  const [expanded, setExpanded] = useState(false);

  const longTitle = post.title.length > 120;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
      {/* bottom scrim for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Right action rail */}
      <div className="pointer-events-auto absolute bottom-28 right-3 flex flex-col items-center gap-5 text-white">
        <button
          onClick={toggleMuted}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex flex-col items-center gap-1"
        >
          <span className="rounded-full bg-black/40 p-2.5">
            {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </span>
        </button>

        <div className="flex flex-col items-center gap-1">
          <span className="rounded-full bg-black/40 p-2.5">
            <ArrowBigUp size={22} />
          </span>
          <span className="text-xs font-semibold">{formatCount(post.ups)}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="rounded-full bg-black/40 p-2.5">
            <MessageSquare size={20} />
          </span>
          <span className="text-xs font-semibold">
            {formatCount(post.numComments)}
          </span>
        </div>

        <Link
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in Reddit"
          className="flex flex-col items-center gap-1"
        >
          <span className="rounded-full bg-black/40 p-2.5">
            <ExternalLink size={20} />
          </span>
        </Link>
      </div>

      {/* Bottom info block */}
      <div className="pointer-events-auto relative z-10 max-w-[80%] space-y-2 p-4 pb-24 text-white">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/r/${post.subreddit}`}
            className="font-semibold hover:underline"
          >
            {post.subredditPrefixed}
          </Link>
          <span className="text-white/60">·</span>
          <span className="text-white/80">u/{post.author}</span>
          <span className="text-white/60">·</span>
          <span className="text-white/70">{timeAgo(post.createdUtc)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {post.flair && <Badge variant="outline">{post.flair}</Badge>}
          {post.over18 && <Badge variant="nsfw">NSFW</Badge>}
        </div>

        <p
          className={`text-[15px] font-semibold leading-snug drop-shadow ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {post.title}
        </p>
        {longTitle && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-white/70"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}
