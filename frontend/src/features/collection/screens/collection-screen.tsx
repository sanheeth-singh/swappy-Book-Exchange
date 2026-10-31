"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { booksApi } from "@/features/books/api";
import { CampusGate } from "@/features/books/components/campus-gate";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
export function CollectionScreen() {
  return (
    <CampusGate>
      <Collection />
    </CampusGate>
  );
}
function Collection() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["books", "collection", offset],
    queryFn: ({ signal }) => booksApi.collection(offset, signal),
  });
  return (
    <div>
      <p className="eyebrow">Physical copies you own</p>
      <h1 className="mt-3 text-4xl">Your collection.</h1>
      <p className="mt-4 text-muted">
        A collection copy is separate from its listing. Relisting may be
        unavailable if the copy is already listed, reserved or restricted.
      </p>
      {query.isPending ? (
        <p role="status">Loading collection…</p>
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
              <Card key={book.id} className="p-5">
                <h3>{book.title}</h3>
                <p className="mt-2 text-sm text-muted">{book.author}</p>
                <ButtonLink
                  href={`/my-books/new?copy=${book.id}`}
                  variant="secondary"
                  className="mt-4"
                >
                  Relist this copy
                </ButtonLink>
              </Card>
            ))}
          </div>
          {!query.data.length && (
            <EmptyState
              title="No copies here yet"
              description="Books you list or receive through completed exchanges appear in your collection."
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
