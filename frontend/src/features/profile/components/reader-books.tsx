"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { detailsApi } from "../details-api";
import { ListingCard } from "@/features/books/components/listing-card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { Book } from "lucide-react";
import {motion} from "framer-motion"
export function ReaderBooks({ id }: { id: string }) {
  const query = useInfiniteQuery({
    queryKey: ["books", "reader", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => detailsApi.books(id, pageParam),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  });

  const books = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.items) ?? []).map((book) => [
        book.id,
        book,
      ]),
    ).values(),
  ];

  return (
    <section className="space-y-6 mt-10">
      <header className="space-y-1 px-1">
        <h2 className="text-3xl font-bold text-slate-800">On this reader’s shelf</h2>
        <p className="text-slate-500 font-medium">
          Available listings visible to you in your campus.
        </p>
      </header>

      {query.isPending ? (
        <div className="card p-8 text-center">
          <p role="status" className="text-slate-500 font-medium animate-pulse">Loading books…</p>
        </div>
      ) : query.isError ? (
        <div className="card p-6 bg-red-50">
          <ErrorState
            message={query.error.message}
            retry={() => {
              void query.refetch();
            }}
          />
        </div>
      ) : books.length ? (
        <div className="book-results-grid">
          {books.map((book) => (
            <ListingCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f7efe5] flex items-center justify-center shadow-inner text-2xl">
            <motion.div
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="p-3 bg-orange-100 rounded-lg w-fit"
          >
            <Book className="text-orange-600" size={18} />
          </motion.div>
          </div>
          <p className="text-slate-500 font-medium">No available listings visible here.</p>
        </div>
      )}

      {query.hasNextPage && (
        <div className="pt-4 flex justify-center md:justify-start">
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => {
              void query.fetchNextPage();
            }}
            className="px-8"
          >
            Load more books
          </Button>
        </div>
      )}
    </section>
  );
}