import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "nsfw" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        variant === "default" && "bg-white/15 text-white backdrop-blur",
        variant === "nsfw" && "bg-red-600 text-white",
        variant === "outline" && "border border-white/30 text-white",
        className
      )}
    >
      {children}
    </span>
  );
}
