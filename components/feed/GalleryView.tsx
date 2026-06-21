"use client";

import { useRef, useState } from "react";
import type { FeedPost } from "@/lib/reddit/types";
import { cn } from "@/lib/utils";

/**
 * Gallery post: horizontal sub-swipe with dot pagination. Each item may be an
 * image or a short mp4 (Reddit serves animated gallery items as mp4).
 */
export function GalleryView({ post }: { post: FeedPost }) {
  const images = post.gallery ?? [];
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 bg-black">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="relative flex h-full w-full flex-none snap-center items-center justify-center"
          >
            {img.url.endsWith(".mp4") ? (
              <video
                src={img.url}
                className="h-full w-full object-contain"
                muted
                loop
                playsInline
                autoPlay={i === index}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.url}
                alt={`${post.title} (${i + 1}/${images.length})`}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* Dot pagination */}
      <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-4 bg-white" : "w-1.5 bg-white/40"
            )}
          />
        ))}
      </div>

      {/* Count badge */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
        {index + 1}/{images.length}
      </div>
    </div>
  );
}
