"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { booksApi } from "../api";
import { ListingCard } from "../components/listing-card";
import { CampusGate } from "../components/campus-gate";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
export function MyBooksScreen() {
  return (
    <CampusGate>
      <Shelf />
    </CampusGate>
  );
}
function Shelf() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["books", "mine", offset],
    queryFn: ({ signal }) => booksApi.mine(offset, signal),
  });
  return (
    <div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your listings</p>
          <h1 className="mt-3 text-4xl">My Books.</h1>
          <p className="mt-3 text-muted">
            Manage active, reserved and archived listings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/collection" variant="secondary">
            Collection
          </ButtonLink>
          <ButtonLink href="/my-books/new">List a book</ButtonLink>
        </div>
      </div>
      {query.isPending ? (
        <p role="status" className="py-8">
          Loading your shelf…
        </p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <div className="book-results-grid mt-6">
            {query.data.map((book) => (
              <ListingCard key={book.id} book={book} own />
            ))}
          </div>
          {!query.data.length && (
            <EmptyState
              title="Your shelf has room"
              description="List a book you own, or relist a copy from your collection."
            />
          )}
          <Pagination
            offset={offset}
            pageSize={12}
            hasMore={query.data.length === 12}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
