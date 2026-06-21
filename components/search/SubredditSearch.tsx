"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import type { SubredditInfo } from "@/lib/reddit/types";
import { formatCount } from "@/lib/utils";

/**
 * Subreddit-name search palette (autocomplete). Debounced calls to the
 * server-side `/api/reddit/search` proxy. Selecting a result routes to that
 * subreddit's single-feed.
 */
export function SubredditSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SubredditInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        const res = await fetch(
          `/api/reddit/search?q=${encodeURIComponent(q.trim())}`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.subreddits ?? []);
        }
      } catch {
        /* aborted or network error */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (name: string) => {
    onClose();
    router.push(`/r/${name}`);
  };

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

        <ul className="max-h-[60vh] overflow-y-auto">
          {results.map((sub) => (
            <li key={sub.name}>
              <button
                onClick={() => go(sub.name)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
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
                  <p className="truncate text-xs text-white/50">
                    {formatCount(sub.subscribers)} members
                    {sub.over18 ? " · NSFW" : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !loading && results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-white/40">
              No subreddits found.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
