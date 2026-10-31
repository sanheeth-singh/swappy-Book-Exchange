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
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
      });
    }
    setSelected(next);
  }
  return (
    <figure
      className="book-gallery"
      aria-label={`Photos of ${title}`}
      aria-roledescription="carousel"
    >
      <div
        id={id}
        ref={track}
        className="gallery-track"
        tabIndex={photos.length > 1 ? 0 : undefined}
        aria-label="Book photos. Swipe horizontally or use the arrow buttons."
        onKeyDown={(event) => {
          if (photos.length < 2) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(active + 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(active - 1);
          }
        }}
        onScroll={() => {
          const node = track.current;
          if (!node || !photos.length) return;
          const children = Array.from(node.children) as HTMLElement[];
          let nearest = 0;
          let distance = Infinity;
          children.forEach((slide, index) => {
            const value = Math.abs(
              slide.offsetLeft - node.offsetLeft - node.scrollLeft,
            );
            if (value < distance) {
              nearest = index;
              distance = value;
            }
          });
          setSelected(nearest);
        }}
      >
        {photos.length ? (
          photos.map((photo, index) => (
            <div
              key={photo.id}
              className="gallery-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`Photo ${index + 1} of ${photos.length}`}
            >
              <BookCover title={title} author={author} coverUrl={photo.url} />
            </div>
          ))
        ) : (
          <div className="gallery-slide">
            <BookCover title={title} author={author} />
          </div>
        )}
      </div>
      {photos.length > 1 && (
        <>
          <Button
            variant="secondary"
            className="gallery-arrow gallery-arrow-previous"
            aria-label="Previous book photo"
            aria-controls={id}
            onClick={() => move(active - 1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            className="gallery-arrow gallery-arrow-next"
            aria-label="Next book photo"
            aria-controls={id}
            onClick={() => move(active + 1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
          <figcaption className="gallery-counter" aria-live="polite">
            Photo {active + 1} of {photos.length}
          </figcaption>
        </>
      )}
    </figure>
  );
}
