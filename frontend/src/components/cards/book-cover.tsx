"use client";
import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
type Props = {
  title: string;
  author: string;
  coverUrl?: string | null;
  compact?: boolean;
  localPreview?: boolean;
  className?: string;
};
export function BookCover({
  title,
  author,
  coverUrl,
  compact = false,
  localPreview = false,
  className,
}: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const cover =
    coverUrl &&
    (/^https?:\/\//.test(coverUrl) ||
      (localPreview && coverUrl.startsWith("blob:")))
      ? coverUrl
      : null;
  return (
    <div
      className={cn("book-cover", compact && "book-cover-compact", className)}
    >
      {cover && cover !== failedUrl ? (
        <Image
          src={cover}
          alt={`Cover of ${title}`}
          fill
          unoptimized
          sizes={compact ? "96px" : "(max-width: 767px) 45vw, 23vw"}
          onError={() => setFailedUrl(cover)}
        />
      ) : (
        <div
          className="book-fallback"
          aria-label={`No cover available for ${title}`}
        >
          <span className="book-fallback-imprint" aria-hidden="true">
            Swappy
          </span>
          <span className="book-fallback-title" aria-hidden="true">
            {title}
          </span>
          {!compact && (
            <span className="text-xs text-muted" aria-hidden="true">
              {author}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
