"use client";

import { motion } from "framer-motion";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/cards/book-cover";
import { conditionLabels } from "@/lib/config/book-labels";
import { listingState } from "../policies";
import type { Book } from "../types";
import { cn } from "@/lib/utils/cn";

export function ListingCard({
  book,
  own = false,
}: {
  book: Book;
  own?: boolean;
}) {
  // Map conditions to glassmorphic colors with high-contrast text
  const conditionColorMap: Record<string, string> = {
    new: "bg-green-500/20 text-green-950 border-green-500/30",
    like_new: "bg-green-500/20 text-green-950 border-green-500/30",
    good: "bg-amber-500/20 text-amber-950 border-amber-500/30",
    fair: "bg-gray-500/20 text-gray-900 border-gray-500/30",
    poor: "bg-gray-500/20 text-gray-900 border-gray-500/30",
  };
  
  const badgeStyle = conditionColorMap[book.condition] || "bg-gray-500/20 text-gray-900 border-gray-500/30";

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }} 
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      {/* 
        Removed .book-card and .book-card-horizontal. 
        Using pure Tailwind to enforce small padding (p-2.5) and the physical book shape.
      */}
      <Card className={cn(
        "group relative h-full flex flex-col p-2.5 overflow-hidden transition-all duration-300",
        "bg-[#FFE3B3] rounded-l-[3px] rounded-r-xl",
        "border-y border-r border-[#FBB931] border-l-4 border-l-[#EA6113] hover:border-[#F88F22] hover:border-l-[#F88F22]",
        "shadow-[2px_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[4px_6px_12px_rgba(234,97,19,0.2)]"
      )}>
        {/* Subtle overlay on the right edge to simulate paper depth */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-[#FBB931]/30 to-transparent z-10 rounded-r-xl" />
        
        {/* compact is removed so it defaults to aspect-[9/16] w-full */}
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.photos?.[0]?.url}
        />
        
        {/* Content container uses flex-col with mt-auto to push the button to the bottom */}
        <div className="min-w-0 flex-1 flex flex-col relative z-20 pt-2.5">
          <div className="flex flex-wrap gap-1 mb-1.5">
             <Badge className="bg-[#EA6113]/10 text-[#EA6113] border-[#EA6113]/30 backdrop-blur-sm shadow-sm text-[9px] px-1.5 py-0.5">
               {listingState(book)}
             </Badge>
             <Badge className={cn("backdrop-blur-sm border shadow-sm transition-colors text-[9px] px-1.5 py-0.5", badgeStyle)}>
               {conditionLabels[book.condition]}
             </Badge>
          </div>
          
          <h3 className="line-clamp-2 break-words text-sm font-bold leading-tight text-neutral-900 transition-colors group-hover:text-[#EA6113]">
            {book.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-neutral-700">
            {book.author}
          </p>

          <div className="mt-auto pt-3">
            <ButtonLink
              href={own ? `/my-books/${book.id}/edit` : `/books/${book.id}`}
              variant="secondary"
              // Scaled down button height and text size to prevent bloating the card size
              className="w-full h-8 text-[11px] px-2 shadow-sm"
            >
              {own ? "Manage" : "View book"}
            </ButtonLink>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}