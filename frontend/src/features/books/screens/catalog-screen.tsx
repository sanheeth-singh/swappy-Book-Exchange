"use client";

import { useState } from "react";
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
import {X} from "lucide-react"
import { LucideIceCream } from "lucide-react";
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

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [loadingText, setLoadingText] = useState("");

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
    enabled: false, // Prevents automatic fetching on component mount
  });

  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== "0") next.set(key, value);
      else next.delete(key);
    }
    router.push(`/books?${next.toString()}`, { scroll: false });
  }

  const handleGenerateMatches = () => {
    setIsAnalyzing(true);
    recommended.refetch(); // Trigger the backend fetch

    // Simulate the terminal processing sequence
    setLoadingText("Initializing terminal connection...");
    setTimeout(() => setLoadingText("Scanning shelf history for reading patterns..."), 600);
    setTimeout(() => setLoadingText("Cross-referencing overlapping genres..."), 1400);
    setTimeout(() => setLoadingText("Isolating top 5 algorithmic matches..."), 2200);

    setTimeout(() => {
      setIsAnalyzing(false);
      setIsRevealed(true);
    }, 3000);
  };

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

      {/* NEW RECOMMENDATION SECTION */}
      {!q && !genre && offset === 0 && (
        <section className="mt-10">
          
          {/* 1. The Banner Trigger */}
          {!isAnalyzing && !isRevealed && (
            <button
              onClick={handleGenerateMatches}
              className="group relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-orange-500/30 p-4 text-left backdrop-blur-md transition-all hover:bg-orange-500/10"
            >
              <div>
                <h2 className="text-lg font-semibold text-orange-400">Generate My 5 Matches</h2>
                <p className="text-sm text-muted-foreground">Use our algorithm to find your next read based on your activity</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 transition-transform group-hover:translate-x-1">
                {/* Clear action icon indicating a button press */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
            </button>
          )}

          {/* 2. The Terminal Loading State */}
          {isAnalyzing && (
            <div className="w-full rounded-xl border border-orange-500/30 p-5 font-mono text-sm shadow-lg backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2 text-orange-400">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-orange-500"></span>
                <span>System working...</span>
              </div>
              <p className="text-muted-foreground">{loadingText}</p>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full animate-[pulse_1s_ease-in-out_infinite] bg-orange-500" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}

          {/* 3. The Revealed Matches (Horizontal Scroll & Wax Seal Badge) */}
          {isRevealed && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Your Algorithmic Matches</h2>
                <button 
                  onClick={() => setIsRevealed(false)} 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted-foreground transition-colors hover:bg-orange-500/10"
                >
                  <X className="w-4 h-4" />
                  Close panel
                </button>
              </div>

              {recommended.isError ? (
                <ErrorState
                  message={recommended.error.message}
                  retry={() => recommended.refetch()}
                />
              ) : recommended.data?.items.length ? (
                <div className="flex snap-x overflow-x-auto pb-8 pt-2">
                  <div className="flex gap-6">
                    {recommended.data.items
                      .filter((item) => item.book.owner_id !== user!.id)
                      .map((item) => (
                        <div key={item.book.id} className="relative w-45 shrink-0 snap-start sm:w-50">
                          <ListingCard book={item.book} />
                          
                          {/* Wax Seal Badge */}
                          <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-neutral-800 px-3 py-1 text-xs font-medium shadow-md backdrop-blur-md">
                            {item.reason === "GENRE_MATCH" ? (
                              <span className="text-orange-400">Genre Match</span>
                            ) : (
                              <span className="text-muted-foreground">Recently Added</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Recommendations will appear when suitable books are available.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}