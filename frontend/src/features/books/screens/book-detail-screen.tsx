"use client";
import { ProposalForm } from "@/features/exchanges/components/proposal-form";
import { useAuth } from "@/features/auth/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { booksApi, bookKeys } from "../api";
import { CampusGate } from "../components/campus-gate";
import { BookGallery } from "@/components/cards/book-gallery";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { conditionLabels } from "@/lib/config/book-labels";
export function BookDetailScreen({ id }: { id: string }) {
  return (
    <CampusGate>
      <Detail id={id} />
    </CampusGate>
  );
}
function Detail({ id }: { id: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: ({ signal }) => booksApi.detail(id, signal),
  });
  if (query.isPending) return <p role="status">Loading book…</p>;
  if (query.isError)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const book = query.data;
  const own = book.owner_id === user?.id;
  return (
    <div className="book-detail-page space-y-4">
      <nav aria-label="Book navigation" className="flex flex-wrap gap-2">
        <ButtonLink variant="secondary" href={own ? "/my-books" : "/books"}>
          {own ? "Back to My Books" : "Back to Discover"}
        </ButtonLink>
      </nav>
      <article className="card book-detail">
        <div className="book-detail-intro">
          <BookGallery
            title={book.title}
            author={book.author}
            photos={book.photos}
          />
          <header className="book-detail-heading">
            <p className="eyebrow">A new chapter awaits</p>
            <Badge>{conditionLabels[book.condition]}</Badge>
            <h1>{book.title}</h1>
            <p className="text-lg text-muted">by {book.author}</p>
            <ButtonLink variant="secondary" href={`/readers/${book.owner_id}`}>
              {own ? "Your reader profile" : "Meet the reader"}
            </ButtonLink>
          </header>
        </div>
        <div className="book-detail-body">
          <section className="space-y-3">
            <h2 className="text-xl">About this copy</h2>
            <p className="whitespace-pre-wrap break-words">
              {book.description}
            </p>
            {book.condition_notes && (
              <div className="help-note">
                <h3>Condition notes</h3>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {book.condition_notes}
                </p>
              </div>
            )}
          </section>
          <ProposalForm requested={book} />
          <div className="flex flex-wrap gap-2">
            {!own && (
              <ButtonLink
                variant="ghost"
                href={`/safety/report?type=LISTING&id=${book.id}`}
              >
                Report listing
              </ButtonLink>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
