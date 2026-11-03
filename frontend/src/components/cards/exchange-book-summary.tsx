import { BookCover } from "./book-cover";

export type ExchangeBookSummary = { title: string; author: string; coverUrl?: string | null };

export function ExchangeBookSummaryCard({ label, book }: { label: string; book: ExchangeBookSummary }) { 
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-900/40 border border-slate-800 backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-wider text-orange-500">
        {label}
      </p>
      <div className="flex items-center gap-4">
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} compact />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold text-slate-200">{book.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{book.author}</p>
        </div>
      </div>
    </div>
  ); 
}