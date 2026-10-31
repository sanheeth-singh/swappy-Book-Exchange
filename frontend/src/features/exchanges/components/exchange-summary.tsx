import { ExchangeBookSummaryCard } from "@/components/cards/exchange-book-summary";
import { givingAndReceiving } from "../policies";
import type { Exchange } from "../types";
export function ExchangeSummary({
  exchange,
  userId,
}: {
  exchange: Exchange;
  userId: string;
}) {
  const books = givingAndReceiving(exchange, userId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <ExchangeBookSummaryCard
        label="You give"
        book={{ ...books.giving, coverUrl: books.giving.photos[0]?.url }}
      />
      <ExchangeBookSummaryCard
        label="You receive"
        book={{ ...books.receiving, coverUrl: books.receiving.photos[0]?.url }}
      />
    </div>
  );
}
