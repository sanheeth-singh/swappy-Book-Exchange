"use client";
import { useAuth } from "@/features/auth/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { booksApi } from "../api";
import { ListingCard } from "../components/listing-card";
import { CampusGate } from "../components/campus-gate";
import { Input, Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
export function CatalogScreen() {
  return (
    <CampusGate>
      <Catalog />
    </CampusGate>
  );
}
function Catalog() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const genre = params.get("genre") ?? "";
  const raw = Number(params.get("offset"));
  const offset = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
  const genres = useQuery({
    queryKey: ["books", "genres"],
    queryFn: booksApi.genres,
  });
  const query = useQuery({
    queryKey: ["books", "catalog", q, genre, offset],
    queryFn: ({ signal }) =>
      booksApi.list(
        { q: q || undefined, genre: genre || undefined, offset, limit: 12 },
        signal,
      ),
  });
  const recommended = useQuery({
    queryKey: ["books", "recommendations"],
    queryFn: booksApi.recommendations,
  });
  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "0") next.set(key, value);
      else next.delete(key);
    }
    router.push(`/books?${next.toString()}`, { scroll: false });
  }
  return (
    <div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your campus shelves</p>
          <h1 className="mt-3 text-4xl">Find your next read.</h1>
        </div>
        <ButtonLink href="/my-books/new">List a book</ButtonLink>
      </div>
      <form
        key={`${q}:${genre}`}
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          navigate({
            q: String(data.get("q") ?? "").trim(),
            genre: String(data.get("genre") ?? ""),
            offset: "0",
          });
        }}
      >
        <Input
          name="q"
          type="search"
          aria-label="Title or author"
          placeholder="Title or author"
          maxLength={200}
          defaultValue={q}
        />
        <Select name="genre" aria-label="Genre" defaultValue={genre}>
          <option value="">All genres</option>
          {genre && !genres.data && (
            <option value={genre}>Selected genre</option>
          )}
          {genres.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>
      {query.isPending ? (
        <p className="py-8" role="status">
          Loading campus books…
        </p>
      ) : query.isError ? (
        <div className="mt-6">
          <ErrorState
            message={query.error.message}
            retry={() => {
              void query.refetch();
            }}
          />
        </div>
      ) : (
        <>
          <div className="book-results-grid mt-6">
            {query.data
              .filter((book) => book.owner_id !== user!.id)
              .map((book) => (
                <ListingCard key={book.id} book={book} />
              ))}
          </div>
          {!query.data.length && (
            <EmptyState
              title="No matching books"
              description="Try another title or genre, or come back when more students have listed books."
            />
          )}
          <Pagination
            offset={offset}
            pageSize={12}
            hasMore={query.data.length === 12}
            pending={query.isFetching}
            onChange={(value) => navigate({ offset: String(value) })}
          />
        </>
      )}
      {!q && !genre && offset === 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">A few reads for you.</h2>
          {recommended.isPending ? (
            <p role="status">Finding suggestions…</p>
          ) : recommended.isError ? (
            <ErrorState
              message={recommended.error.message}
              retry={() => {
                void recommended.refetch();
              }}
            />
          ) : recommended.data?.items.length ? (
            <div className="book-results-grid mt-4">
              {recommended.data.items
                .filter((item) => item.book.owner_id !== user!.id)
                .map((item) => (
                  <div key={item.book.id}>
                    <ListingCard book={item.book} />
                    <p className="mt-2 text-xs text-muted">
                      {item.reason === "GENRE_MATCH"
                        ? "Matches your genres"
                        : "Recently available"}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Recommendations will appear when suitable books are available.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
