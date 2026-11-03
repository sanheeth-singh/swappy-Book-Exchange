"use client";
import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BookCover } from "./book-cover";
import { Button } from "@/components/ui/button";

export function BookGallery({
  title,
  author,
  photos,
}: {
  title: string;
  author: string;
  photos: { id: string; url: string }[];
}) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const active = Math.min(selected, Math.max(0, photos.length - 1));

  function move(index: number) {
    const next = (index + photos.length) % photos.length;
    const node = track.current;
    const slide = node?.children[next] as HTMLElement | undefined;
    if (node && slide) {
      node.scrollTo({
        left: slide.offsetLeft - node.offsetLeft,
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
    setSelected(next);
  }

  return (
    <figure className="relative group w-full max-w-sm mx-auto" aria-label={`Photos of ${title}`} aria-roledescription="carousel">
      <div
        id={id}
        ref={track}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth rounded-xl border border-slate-800"
        tabIndex={photos.length > 1 ? 0 : undefined}
        onKeyDown={(event) => {
          if (photos.length < 2) return;
          if (event.key === "ArrowRight") { event.preventDefault(); move(active + 1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); move(active - 1); }
        }}
        onScroll={() => {
          const node = track.current;
          if (!node || !photos.length) return;
          const children = Array.from(node.children) as HTMLElement[];
          let nearest = 0;
          let distance = Infinity;
          children.forEach((slide, index) => {
            const value = Math.abs(slide.offsetLeft - node.offsetLeft - node.scrollLeft);
            if (value < distance) { nearest = index; distance = value; }
          });
          setSelected(nearest);
        }}
      >
        {photos.length ? (
          photos.map((photo, index) => (
            <div key={photo.id} className="w-full shrink-0 snap-center" role="group" aria-roledescription="slide">
              <BookCover title={title} author={author} coverUrl={photo.url} className="rounded-none border-none" />
            </div>
          ))
        ) : (
          <div className="w-full shrink-0 snap-center">
            <BookCover title={title} author={author} className="rounded-none border-none" />
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-700 text-white hover:bg-orange-500 hover:border-orange-400"
              onClick={() => move(active - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
          </div>
          <div className="absolute inset-y-0 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-700 text-white hover:bg-orange-500 hover:border-orange-400"
              onClick={() => move(active + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <figcaption className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur text-[10px] font-mono text-slate-300">
            {active + 1} / {photos.length}
          </figcaption>
        </>
      )}
    </figure>
  );
}