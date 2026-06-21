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
}

/**
 * Client-side feed state. Persisted bits (mute, sort prefs, nsfw) survive
 * reloads via localStorage; activeIndex is intentionally NOT persisted here
 * (resume-position uses sessionStorage per-feed instead).
 */
export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
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
      }),
    }
  )
);
