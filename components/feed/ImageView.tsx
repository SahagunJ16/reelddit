"use client";

import { useState } from "react";
import Image from "next/image";
import type { FeedPost } from "@/lib/reddit/types";

/**
 * Single-image post. Uses next/image with the low-res preview as a blur-up
 * placeholder. Calls onError so the feed can auto-skip broken media.
 */
export function ImageView({
  post,
  onError,
}: {
  post: FeedPost;
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!post.imageUrl) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {post.placeholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.placeholder}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-300 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      <Image
        src={post.imageUrl}
        alt={post.title}
        fill
        sizes="100vw"
        className="object-contain"
        onLoad={() => setLoaded(true)}
        onError={() => onError?.()}
        // Load directly in the browser (no Vercel-side optimizer fetch) so guest
        // images come from the user's IP, consistent with the client-side feed.
        unoptimized
        priority={false}
      />
    </div>
  );
}
