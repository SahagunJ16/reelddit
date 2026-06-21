"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, X, Loader2, Star } from "lucide-react";
import type { SubredditInfo } from "@/lib/reddit/types";
import { useFeedStore } from "@/lib/stores/feed-store";
import { fetchPublicSearch } from "@/lib/reddit/public-client";
import { formatCount, cn } from "@/lib/utils";

/**
 * Subreddit-name search palette (autocomplete). Debounced calls to the
 * server-side `/api/reddit/search` proxy. Tapping a result jumps into that
 * subreddit's feed; the star toggles it in the locally-saved list that powers
 * the guest mixed feed.
 */
export function SubredditSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SubredditInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const savedSubreddits = useFeedStore((s) => s.savedSubreddits);
  const saveSubreddit = useFeedStore((s) => s.saveSubreddit);
  const unsaveSubreddit = useFeedStore((s) => s.unsaveSubreddit);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        if (authenticated) {
          // Signed in: use the server OAuth proxy (autocomplete endpoint).
          const res = await fetch(
            `/api/reddit/search?q=${encodeURIComponent(q.trim())}`,
            { signal: ctrl.signal }
          );
          if (res.ok) {
            const data = await res.json();
            setResults(data.subreddits ?? []);
          }
        } else {
          // Guest: query Reddit directly from the browser (residential IP).
          setResults(await fetchPublicSearch(q.trim()));
        }
      } catch {
        /* aborted, CORS, or network error */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, authenticated]);

  const go = (name: string) => {
    onClose();
    router.push(`/r/${name}`);
  };

  // When there's no query, show the user's saved list for quick management.
  const showingSaved = q.trim().length < 2 && savedSubreddits.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-2xl bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <Search size={18} className="text-white/50" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subreddits…"
            className="flex-1 bg-transparent py-4 text-white placeholder:text-white/40 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].name);
              if (e.key === "Escape") onClose();
            }}
          />
          {loading ? (
            <Loader2 size={18} className="animate-spin text-white/50" />
          ) : (
            <button onClick={onClose} aria-label="Close">
              <X size={18} className="text-white/50" />
            </button>
          )}
        </div>

        {showingSaved && (
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
            Saved subreddits
          </p>
        )}

        <ul className="max-h-[60vh] overflow-y-auto">
          {(showingSaved
            ? savedSubreddits.map(
                (name): SubredditInfo => ({
                  name,
                  displayName: name,
                  prefixed: `r/${name}`,
                  title: "",
                  iconUrl: null,
                  subscribers: 0,
                  over18: false,
                })
              )
            : results
          ).map((sub) => {
            const saved = savedSubreddits.includes(sub.name);
            return (
              <li key={sub.name} className="flex items-center gap-1 pr-2">
                <button
                  onClick={() => go(sub.name)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {sub.iconUrl ? (
                    <img
                      src={sub.iconUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-reddit text-sm font-bold text-white">
                      {sub.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {sub.prefixed}
                    </p>
                    {(sub.subscribers > 0 || sub.over18) && (
                      <p className="truncate text-xs text-white/50">
                        {sub.subscribers > 0 &&
                          `${formatCount(sub.subscribers)} members`}
                        {sub.over18 ? " · NSFW" : ""}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() =>
                    saved ? unsaveSubreddit(sub.name) : saveSubreddit(sub.name)
                  }
                  aria-label={saved ? "Remove from saved" : "Save subreddit"}
                  title={saved ? "Remove from saved" : "Save to my feed"}
                  className="shrink-0 rounded-full p-2 hover:bg-white/10"
                >
                  <Star
                    size={18}
                    className={cn(
                      saved ? "fill-yellow-400 text-yellow-400" : "text-white/50"
                    )}
                  />
                </button>
              </li>
            );
          })}

          {q.trim().length >= 2 && !loading && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-white/40">
              No subreddits found.
            </li>
          )}
          {!showingSaved && q.trim().length < 2 && (
            <li className="px-4 py-6 text-center text-sm text-white/40">
              Search any subreddit, then ⭐ to add it to your feed.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
