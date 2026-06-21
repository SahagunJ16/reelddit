"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useFeed, type FeedParams } from "@/lib/hooks/use-feed";
import { useFeedStore } from "@/lib/stores/feed-store";
import { FeedSkeleton } from "@/components/ui/skeleton";
import { PostCard } from "./PostCard";

const PREFETCH_THRESHOLD = 3; // start loading next page N cards from the end

/**
 * Virtualized, scroll-snap vertical feed. Tracks the active card via
 * IntersectionObserver, mounts only active ± 1 heavy players, prefetches the
 * next page a few cards early, auto-skips broken media, and remembers scroll
 * position per feed (sessionStorage).
 */
export function FeedContainer({
  params,
  feedKey,
}: {
  params: FeedParams;
  feedKey: string;
}) {
  const {
    posts,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useFeed(params);

  const setActiveIndexStore = useFeedStore((s) => s.setActiveIndex);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-skip: drop posts whose media failed to load.
  const onSkip = useCallback((id: string) => {
    setHidden((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const visible = useMemo(
    () => posts.filter((p) => !hidden.has(p.id)),
    [posts, hidden]
  );

  const storageKey = `reelddit:resume:${feedKey}`;

  // IntersectionObserver to determine the active (most-visible) card.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.index ?? "0"
            );
            setActiveIndex(idx);
            setActiveIndexStore(idx);
          }
        }
      },
      { root, threshold: [0.6] }
    );

    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [visible.length, setActiveIndexStore]);

  // Prefetch the next page a few cards before the end.
  useEffect(() => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      activeIndex >= visible.length - PREFETCH_THRESHOLD
    ) {
      fetchNextPage();
    }
  }, [
    activeIndex,
    visible.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // Resume position: restore once the first batch is present.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || visible.length === 0) return;
    restoredRef.current = true;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const idx = Math.min(Number(saved), visible.length - 1);
      const el = cardRefs.current[idx];
      if (el) el.scrollIntoView();
    }
  }, [visible.length, storageKey]);

  // Persist position on active change.
  useEffect(() => {
    if (restoredRef.current) {
      sessionStorage.setItem(storageKey, String(activeIndex));
    }
  }, [activeIndex, storageKey]);

  // --- Pull-to-refresh (touch) ---
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) setPullDistance(Math.min(dy, 120));
  };
  const onTouchEnd = () => {
    if (pullDistance > 70) {
      setHidden(new Set());
      refetch();
      if (containerRef.current) containerRef.current.scrollTo({ top: 0 });
    }
    pullStartY.current = null;
    setPullDistance(0);
  };

  if (isLoading) return <FeedSkeleton />;

  if (isError) {
    const code = (error as Error)?.message;
    const unauth = code === "unauthenticated";
    const blocked = code === "reddit_blocked";
    const unreachable = code === "reddit_unreachable";
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold">
          {unauth
            ? "Your session expired"
            : unreachable
              ? "Can't reach Reddit from your browser"
              : blocked
                ? "Reddit blocked the request"
                : "Couldn't load the feed"}
        </p>
        <p className="max-w-xs text-sm text-white/60">
          {unauth
            ? "Please sign in with Reddit again."
            : unreachable
              ? "Your browser blocked the request to Reddit — this can happen with strict tracking protection (e.g. Safari). Try disabling it for this site, or sign in with Reddit."
              : blocked
                ? "Reddit is rate-limiting or blocking requests right now. Try again in a moment, or sign in with Reddit."
                : "Reddit may be rate-limiting or unreachable. Try again."}
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-2 bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold">No media posts here</p>
        <p className="text-sm text-white/60">
          Try a different sort, subreddit, or enable NSFW.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefetching) && (
        <div
          className="flex w-full items-center justify-center text-white"
          style={{ height: isRefetching ? 48 : pullDistance }}
        >
          <RefreshCw
            size={20}
            className={isRefetching ? "animate-spin" : ""}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      )}

      {visible.map((post, i) => {
        const mounted = Math.abs(i - activeIndex) <= 1;
        return (
          <div
            key={post.id}
            data-index={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="h-[100dvh] w-full snap-start"
          >
            <PostCard
              post={post}
              active={i === activeIndex}
              mounted={mounted}
              onSkip={onSkip}
            />
          </div>
        );
      })}

      {isFetchingNextPage && (
        <div className="flex h-16 w-full items-center justify-center bg-black text-white">
          <Loader2 className="animate-spin" size={22} />
        </div>
      )}
    </div>
  );
}
