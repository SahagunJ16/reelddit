"use client";

import { Flame, Clock, TrendingUp, ArrowUp } from "lucide-react";
import { useFeedStore } from "@/lib/stores/feed-store";
import type { SortOption, TimeRange } from "@/lib/reddit/types";
import { cn } from "@/lib/utils";

const SORTS: { value: SortOption; label: string; icon: typeof Flame }[] = [
  { value: "hot", label: "Hot", icon: Flame },
  { value: "new", label: "New", icon: Clock },
  { value: "top", label: "Top", icon: ArrowUp },
  { value: "rising", label: "Rising", icon: TrendingUp },
];

const RANGES: TimeRange[] = ["hour", "day", "week", "month", "year", "all"];
const RANGE_LABELS: Record<TimeRange, string> = {
  hour: "Now",
  day: "Today",
  week: "Week",
  month: "Month",
  year: "Year",
  all: "All",
};

export function SortFilterBar() {
  const sort = useFeedStore((s) => s.sort);
  const setSort = useFeedStore((s) => s.setSort);
  const timeRange = useFeedStore((s) => s.timeRange);
  const setTimeRange = useFeedStore((s) => s.setTimeRange);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-full bg-black/40 p-1 backdrop-blur">
        {SORTS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              sort === value
                ? "bg-white text-black"
                : "text-white/80 hover:text-white"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {sort === "top" && (
        <div className="flex gap-1 self-start rounded-full bg-black/40 p-1 backdrop-blur">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                timeRange === r
                  ? "bg-white/90 text-black"
                  : "text-white/70 hover:text-white"
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
