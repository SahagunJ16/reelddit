import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FeedMode, SortOption, TimeRange } from "@/lib/reddit/types";

interface FeedState {
  // playback / UI
  muted: boolean;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;

  activeIndex: number;
  setActiveIndex: (i: number) => void;

  // discovery filters
  mode: FeedMode;
  sort: SortOption;
  timeRange: TimeRange;
  nsfw: boolean;
  shuffle: boolean;

  setSort: (s: SortOption) => void;
  setTimeRange: (t: TimeRange) => void;
  setMode: (m: FeedMode) => void;
  setNsfw: (v: boolean) => void;
  toggleShuffle: () => void;

  // "Saved" subreddits for guests (no Reddit account) — the local stand-in for
  // a subscription list. Stored as lowercase names.
  savedSubreddits: string[];
  saveSubreddit: (name: string) => void;
  unsaveSubreddit: (name: string) => void;
  isSaved: (name: string) => boolean;
}

/**
 * Client-side feed state. Persisted bits (mute, sort prefs, nsfw) survive
 * reloads via localStorage; activeIndex is intentionally NOT persisted here
 * (resume-position uses sessionStorage per-feed instead).
 */
export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      muted: true,
      setMuted: (m) => set({ muted: m }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),

      activeIndex: 0,
      setActiveIndex: (i) => set({ activeIndex: i }),

      mode: "mixed",
      sort: "hot",
      timeRange: "day",
      nsfw: false,
      shuffle: false,

      setSort: (sort) => set({ sort }),
      setTimeRange: (timeRange) => set({ timeRange }),
      setMode: (mode) => set({ mode }),
      setNsfw: (nsfw) => set({ nsfw }),
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

      savedSubreddits: [],
      saveSubreddit: (name) =>
        set((s) => {
          const n = name.toLowerCase();
          if (s.savedSubreddits.includes(n)) return s;
          return { savedSubreddits: [...s.savedSubreddits, n] };
        }),
      unsaveSubreddit: (name) =>
        set((s) => ({
          savedSubreddits: s.savedSubreddits.filter(
            (x) => x !== name.toLowerCase()
          ),
        })),
      isSaved: (name) => get().savedSubreddits.includes(name.toLowerCase()),
    }),
    {
      name: "reelddit-prefs",
      partialize: (s) => ({
        muted: s.muted,
        sort: s.sort,
        timeRange: s.timeRange,
        mode: s.mode,
        nsfw: s.nsfw,
        shuffle: s.shuffle,
        savedSubreddits: s.savedSubreddits,
      }),
    }
  )
);
