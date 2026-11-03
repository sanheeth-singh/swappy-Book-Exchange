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
    className={cn(
      "relative overflow-hidden rounded-md shadow-inner border border-[#FBB931]/50 bg-[#FFE3B3]/50",
      // CHANGE aspect-[9/16] to aspect-[2/3]
      compact ? "w-12 h-20 shrink-0" : "aspect-2/3 w-full", 
      className
    )}
  >
      {cover && cover !== failedUrl ? (
        <Image
          src={cover}
          alt={`Cover of ${title}`}
          fill
          className="object-cover"
          unoptimized
          sizes={compact ? "48px" : "(max-width: 767px) 45vw, 23vw"}
          onError={() => setFailedUrl(cover)}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-[#FFE3B3] to-[#FBB931]/30"
          aria-label={`No cover available for ${title}`}
        >
          <span className="text-[8px] font-mono uppercase tracking-widest text-[#EA6113] mb-1" aria-hidden="true">
            bSwappy
          </span>
          <span className="text-xs font-serif italic font-bold text-neutral-900 line-clamp-3 leading-tight" aria-hidden="true">
            {title}
          </span>
          {!compact && (
            <span className="mt-1 text-[9px] text-neutral-700 line-clamp-2" aria-hidden="true">
              {author}
            </span>
          )}
        </div>
      )}
    </div>
  );
}