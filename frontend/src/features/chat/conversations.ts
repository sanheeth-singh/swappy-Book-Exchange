import { protectedRequest } from "@/features/auth/session";
import type { Exchange } from "@/features/exchanges/types";
export type ConversationCursor = { sent?: number; received?: number };
export type ConversationPage = { items: Exchange[]; next?: ConversationCursor };
export function canOpenConversation(exchange: Exchange, userId: string) {
  return (
    !!exchange.accepted_at &&
    [exchange.owner_id, exchange.requester_id].includes(userId)
  );
}
export function activeConversation(exchange: Exchange) {
  return ["ACCEPTED", "WAITING_CONFIRMATION"].includes(exchange.status);
}
export function conversationList(pages: ConversationPage[], userId: string) {
  return [
    ...new Map(
      pages
        .flatMap((page) => page.items)
        .filter((exchange) => canOpenConversation(exchange, userId))
        .map((exchange) => [exchange.id, exchange]),
    ).values(),
  ].sort((a, b) => Date.parse(b.accepted_at!) - Date.parse(a.accepted_at!));
}
// The backend has no conversation-list endpoint. Page both participant feeds without
// hiding older matches behind an empty filtered page or scanning an unbounded history.
export async function conversationPage(
  cursor: ConversationCursor,
  signal?: AbortSignal,
): Promise<ConversationPage> {
  const directions = ["sent", "received"] as const;
  const feeds = await Promise.all(
    directions.map((direction) =>
      cursor[direction] === undefined
        ? Promise.resolve([] as Exchange[])
        : protectedRequest<Exchange[]>({
            url: `/exchanges/${direction}`,
            params: { offset: cursor[direction], limit: 50 },
            signal,
          }),
    ),
  );
  const next: ConversationCursor = {};
  feeds.forEach((items, index) => {
    const direction = directions[index];
    if (items.length === 50) next[direction] = (cursor[direction] ?? 0) + 50;
  });
  return {
    items: feeds.flat(),
    next: Object.keys(next).length ? next : undefined,
  };
}
