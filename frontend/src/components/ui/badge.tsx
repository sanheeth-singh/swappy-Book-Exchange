import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?:
    | "neutral"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "complete"
    | "quiet";
}) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)} {...props} />
  );
}
