import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";
export function Input({ className, ...props }: ComponentProps<"input">) { return <input className={cn("field", className)} {...props} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select className={cn("field", className)} {...props} />; }
export function Textarea({ className, ...props }: ComponentProps<"textarea">) { return <textarea className={cn("field", className)} {...props} />; }
