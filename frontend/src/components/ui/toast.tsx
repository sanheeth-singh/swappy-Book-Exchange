"use client";
import { useToastStore } from "@/stores/toast-store";
import { Button } from "./button";
export function ToastHost() { const { items, dismiss } = useToastStore(); return <div className="toast-region space-y-3" aria-live="polite" aria-atomic="false">{items.map((item) => <div key={item.id} role={item.tone === "error" ? "alert" : "status"} className="card flex items-center justify-between gap-3 p-4"><p className="min-w-0 break-words text-sm">{item.message}</p><Button variant="ghost" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">Close</Button></div>)}</div>; }
