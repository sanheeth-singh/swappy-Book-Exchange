import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "./book-cover";
import { conditionLabels } from "@/lib/config/book-labels";
import type { PublicBook } from "@/features/public-preview/types";
import { cn } from "@/lib/utils/cn";

export function BookCard({ book }: { book: PublicBook }) {
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
      <Card className={cn(
        "group relative h-full flex flex-col p-2.5 overflow-hidden transition-all duration-300",
        "bg-[#FFE3B3] rounded-l-[3px] rounded-r-xl",
        "border-y border-r border-[#FBB931] border-l-4 border-l-[#EA6113] hover:border-[#F88F22] hover:border-l-[#F88F22]",
        "shadow-[2px_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[4px_6px_12px_rgba(234,97,19,0.2)]"
      )}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-[#FBB931]/30 to-transparent z-10 rounded-r-xl" />
        
        <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} />
        
        <div className="min-w-0 flex-1 relative z-20 pt-2.5">
          <Badge className={cn("backdrop-blur-sm border shadow-sm transition-colors text-[9px] px-1.5 py-0.5", badgeStyle)}>
            {conditionLabels[book.condition]}
          </Badge>
          
          <h3 className="mt-1.5 line-clamp-2 break-words text-sm font-bold leading-tight text-neutral-900 transition-colors group-hover:text-[#EA6113]">
            {book.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-neutral-700">
            {book.author}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}