"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { BookCard } from "@/components/cards/book-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { publicBooksOptions } from "../queries";
import { parseOffset, previewSearch } from "../filters";
export function ExploreScreen() {
 const router = useRouter(); const params = useSearchParams(); const q = params.get("q") ?? ""; const genre = params.get("genre") ?? ""; const offset = parseOffset(params.get("offset"));
 const query = useQuery(publicBooksOptions({ q, genre, offset }));
 // Keep the genre directory stable while another filtered page loads.
 const directory = useQuery(publicBooksOptions({ q: "", genre: "", offset: 0 }));
 const genres = directory.data?.genres ?? query.data?.genres ?? [];
 function navigate(changes: Record<string, string | number | null>) { const search = previewSearch(new URLSearchParams(params.toString()), changes); router.push(`/explore${search ? `?${search}` : ""}`, { scroll: false }); }
 return <section className="container py-8 md:py-12"><div className="section-heading"><div><p className="eyebrow">A glimpse of the shelves</p><h1 className="mt-3 text-4xl md:text-5xl">Find your next chapter.</h1><p className="mt-4 max-w-xl text-muted">A limited selection of publicly shared books. Complete your profile after registration to discover your campus shelves.</p></div><ButtonLink href="/help" variant="ghost">How exchanges work</ButtonLink></div>
 <form key={q} className="search-toolbar mt-7" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); navigate({ q: String(form.get("q") ?? "").trim(), offset: 0 }); }}><div className="min-w-0 flex-1"><label htmlFor="search" className="sr-only">Search by title or author</label><Input id="search" name="q" type="search" maxLength={200} defaultValue={q} placeholder="Title or author" /></div><Button type="submit">Search</Button></form>
 <div className="my-4"><HorizontalScroll label="Book genres"><button className="filter-chip" type="button" aria-pressed={!genre} onClick={() => navigate({ genre: null, offset: 0 })}>All genres</button>{genres.map((item) => <button key={item.id} className="filter-chip" type="button" aria-pressed={genre === item.id} onClick={() => navigate({ genre: item.id, offset: 0 })}>{item.name}</button>)}</HorizontalScroll></div>
 {(q || genre) && <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{q ? `Searching for “${q}”` : "Filtered by genre"}</p><Button variant="ghost" onClick={() => navigate({ q: null, genre: null, offset: 0 })}>Clear filters</Button></div>}
 {query.isPending ? <div role="status"><span className="sr-only">Loading books</span><div className="book-results-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div></div> : query.isError ? <ErrorState message={query.error.message} retry={() => { void query.refetch(); void directory.refetch(); }} /> : <><div className="mb-4 flex flex-wrap justify-between gap-2 text-sm text-muted" aria-live="polite"><span>{query.data.total} books in this preview</span><span>Public selection · up to {query.data.preview_limit} books</span></div>{query.data.items.length ? <div className="book-results-grid">{query.data.items.map((book) => <BookCard key={book.id} book={book} layout="horizontal" />)}</div> : <EmptyState title="No books found" description={q || genre ? "Try a different title, author, or genre." : "There are no public preview books to show yet. Check back soon."} />}<nav aria-label="Book pagination" className="mt-6 flex items-center justify-between gap-3"><Button variant="secondary" disabled={offset === 0 || query.isFetching} onClick={() => navigate({ offset: Math.max(0, offset - 12) })}>Previous</Button><span className="text-sm text-muted">Page {Math.floor(offset / 12) + 1}</span><Button variant="secondary" disabled={query.data.next_offset === null || query.isFetching} onClick={() => navigate({ offset: query.data.next_offset })}>Next</Button></nav><div className="discovery-invitation mt-8"><div><h2 className="text-xl">Your campus has more stories.</h2><p className="mt-2 text-sm text-muted">{query.data.registration_message}</p><p className="mt-2 text-xs text-muted">Create an account, complete your profile, and verify your campus to take part.</p></div><ButtonLink href="/help#membership" variant="secondary">Learn about campus access</ButtonLink><ButtonLink href="/register">Create account</ButtonLink></div></>}
 </section>;
}
