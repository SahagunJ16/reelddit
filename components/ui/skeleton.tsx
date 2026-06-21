import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/10", className)} />
  );
}

/** Full-screen feed skeleton shown while the first page loads. */
export function FeedSkeleton() {
  return (
    <div className="flex h-[100dvh] w-full flex-col justify-end gap-3 bg-neutral-900 p-5 pb-24">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
