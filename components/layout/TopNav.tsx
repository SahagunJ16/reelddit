"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, Shuffle, EyeOff, Eye, LogOut, Home } from "lucide-react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { SortFilterBar } from "@/components/feed/SortFilterBar";
import { SubredditSearch } from "@/components/search/SubredditSearch";
import { cn } from "@/lib/utils";

/**
 * Top navigation overlay for the feed: search trigger, NSFW/shuffle toggles,
 * sort filter bar, and logout. `mode` controls the leading button (a home
 * button back to the mixed feed when viewing a single subreddit).
 */
export function TopNav({
  mode = "mixed",
  subtitle,
}: {
  mode?: "mixed" | "single";
  subtitle?: string;
}) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const nsfw = useFeedStore((s) => s.nsfw);
  const setNsfw = useFeedStore((s) => s.setNsfw);
  const shuffle = useFeedStore((s) => s.shuffle);
  const toggleShuffle = useFeedStore((s) => s.toggleShuffle);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent pb-8">
        <div className="pointer-events-auto flex items-start justify-between gap-3 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">
                reel<span className="text-reddit">ddit</span>
              </span>
              {subtitle && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white">
                  {subtitle}
                </span>
              )}
            </div>
            <SortFilterBar />
          </div>

          <div className="flex items-center gap-1.5">
            {mode === "single" && (
              <IconButton
                label="Back to mixed feed"
                onClick={() => router.push("/feed")}
              >
                <Home size={18} />
              </IconButton>
            )}
            <IconButton
              label="Shuffle feed"
              active={shuffle}
              onClick={toggleShuffle}
            >
              <Shuffle size={18} />
            </IconButton>
            <IconButton
              label="Toggle NSFW"
              active={nsfw}
              onClick={() => setNsfw(!nsfw)}
            >
              {nsfw ? <Eye size={18} /> : <EyeOff size={18} />}
            </IconButton>
            <IconButton
              label="Search subreddits"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </IconButton>
            <IconButton
              label="Log out"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={18} />
            </IconButton>
          </div>
        </div>
      </div>

      {searchOpen && <SubredditSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function IconButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-full p-2 text-white transition",
        active ? "bg-white text-black" : "bg-black/40 hover:bg-black/60"
      )}
    >
      {children}
    </button>
  );
}
