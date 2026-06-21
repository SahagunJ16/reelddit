"use client";

import { forwardRef } from "react";
import type { FeedPost } from "@/lib/reddit/types";
import { VideoPlayer } from "./VideoPlayer";
import { ImageView } from "./ImageView";
import { GalleryView } from "./GalleryView";
import { PostOverlay } from "./PostOverlay";

interface PostCardProps {
  post: FeedPost;
  active: boolean;
  /** True when within the active ± 1 window — only then mount heavy players. */
  mounted: boolean;
  onSkip: (id: string) => void;
}

/**
 * One full-viewport feed card. Routes to the right media renderer and overlays
 * the info layer. Out-of-window cards render only a lightweight thumbnail so
 * the feed stays cheap to scroll (virtualization).
 */
export const PostCard = forwardRef<HTMLDivElement, PostCardProps>(
  function PostCard({ post, active, mounted, onSkip }, ref) {
    return (
      <section
        ref={ref}
        data-post-id={post.id}
        className="relative h-[100dvh] w-full flex-none snap-start snap-always overflow-hidden bg-black"
      >
        {mounted ? (
          <>
            {post.kind === "video" && (
              <VideoPlayer
                post={post}
                active={active}
                onError={() => onSkip(post.id)}
              />
            )}
            {post.kind === "image" && (
              <ImageView post={post} onError={() => onSkip(post.id)} />
            )}
            {post.kind === "gallery" && <GalleryView post={post} />}
          </>
        ) : (
          // Lightweight placeholder for off-window cards.
          <div className="absolute inset-0 bg-neutral-900">
            {(post.placeholder || post.poster) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.placeholder || post.poster}
                alt=""
                aria-hidden
                className="h-full w-full scale-110 object-cover blur-xl opacity-60"
              />
            )}
          </div>
        )}

        <PostOverlay post={post} />
      </section>
    );
  }
);
