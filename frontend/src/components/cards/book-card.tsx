import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "./book-cover";
import { conditionLabels } from "@/lib/config/book-labels";
import type { PublicBook } from "@/features/public-preview/types";
import { cn } from "@/lib/utils/cn";
export function BookCard({ book, layout = "portrait" }: { book: PublicBook; layout?: "portrait" | "horizontal" }) {
 const horizontal = layout === "horizontal";
 return <Card className={cn("book-card", horizontal && "book-card-horizontal")}><BookCover title={book.title} author={book.author} coverUrl={book.cover_url} compact={horizontal} /><div className={cn("min-w-0", !horizontal && "pt-4")}><Badge>{conditionLabels[book.condition]}</Badge><h3 className="mt-3 line-clamp-2 break-words text-base">{book.title}</h3><p className="mt-1 line-clamp-2 text-sm text-muted">{book.author}</p></div></Card>;
}

