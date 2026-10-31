"use client";
import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
export function HorizontalScroll({ label, children }: { label: string; children: ReactNode }) {
 const row = useRef<HTMLDivElement>(null); const id = useId(); const [position, setPosition] = useState({ before: false, after: false });
 useEffect(() => {
  const element = row.current; if (!element) return;
  const measure = () => setPosition({ before: element.scrollLeft > 2, after: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
  measure(); const resize = new ResizeObserver(measure); resize.observe(element); if (element.firstElementChild) resize.observe(element.firstElementChild);
  element.addEventListener("scroll", measure, { passive: true });
  return () => { resize.disconnect(); element.removeEventListener("scroll", measure); };
 }, [children]);
 function move(direction: number) { const element = row.current; if (element) element.scrollBy({ left: direction * element.clientWidth * .75, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
 const overflow = position.before || position.after;
 return <div><div className="mb-2 flex min-h-11 items-center justify-between gap-3"><p className="text-xs text-muted" id={`${id}-hint`}>{overflow ? "Swipe, scroll, or use the arrows for more." : label}</p>{overflow && <div className="flex shrink-0 gap-1"><Button variant="ghost" className="scroll-control" aria-label={`Earlier ${label.toLowerCase()}`} aria-controls={id} disabled={!position.before} onClick={() => move(-1)}><ChevronLeft size={18} aria-hidden="true" /></Button><Button variant="ghost" className="scroll-control" aria-label={`More ${label.toLowerCase()}`} aria-controls={id} disabled={!position.after} onClick={() => move(1)}><ChevronRight size={18} aria-hidden="true" /></Button></div>}</div><div className="horizontal-scroll" ref={row} id={id} role="region" aria-label={label} aria-describedby={`${id}-hint`} tabIndex={0}><div className="flex w-max min-w-full gap-2 pb-2">{children}</div></div></div>;
}
