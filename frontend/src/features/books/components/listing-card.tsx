import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/cards/book-cover";
import { conditionLabels } from "@/lib/config/book-labels";
import { listingState } from "../policies";
import type { Book } from "../types";
export function ListingCard({
  book,
  own = false,
}: {
  book: Book;
  own?: boolean;
}) {
  return (
    <Card className="book-card book-card-horizontal">
      <BookCover
        title={book.title}
        author={book.author}
        coverUrl={book.photos[0]?.url}
        compact
      />
      <div className="min-w-0">
        <Badge>{listingState(book)}</Badge>
        <h3 className="mt-2 line-clamp-2 break-words text-base">
          {book.title}
        </h3>
        <p className="mt-1 text-sm text-muted">{book.author}</p>
        <p className="mt-1 text-xs text-muted">
          {conditionLabels[book.condition]}
        </p>
        <ButtonLink
          href={own ? `/my-books/${book.id}/edit` : `/books/${book.id}`}
          variant="secondary"
          className="mt-3"
        >
          {own ? "Manage listing" : "View book"}
        </ButtonLink>
      </div>
    </Card>
  );
}
