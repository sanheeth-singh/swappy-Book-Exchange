"use client";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { ExchangeStatusBadge } from "@/features/exchanges/components/exchange-status-badge";
import { givingAndReceiving } from "@/features/exchanges/policies";
import {
  conversationPage,
  conversationList,
  activeConversation,
  type ConversationCursor,
} from "../conversations";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";

export function ConversationInbox({ selectedId }: { selectedId?: string }) {
  const { user } = useAuth();
  const [history, setHistory] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["exchanges", "conversations"],
    initialPageParam: { sent: 0, received: 0 } as ConversationCursor,
    queryFn: ({ pageParam, signal }) => conversationPage(pageParam, signal),
    getNextPageParam: (page) => page.next,
    refetchOnWindowFocus: true,
  });

  const all = conversationList(query.data?.pages ?? [], user!.id);
  const items = all.filter((exchange) =>
    history ? !activeConversation(exchange) : activeConversation(exchange),
  );

  return (
    <aside className="clay-card p-6 flex flex-col gap-4" aria-label="Exchange conversations">
      <div className="space-y-3 mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Conversations</h2>
        <p className="text-sm text-slate-500">
          Chat opens when an exchange is accepted.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            className={`px-4 py-2 ${!history ? 'clay-input' : 'clay-btn'} text-sm`}
            aria-pressed={!history}
            onClick={() => setHistory(false)}
          >
            Active
          </button>
          <button
            className={`px-4 py-2 ${history ? 'clay-input' : 'clay-btn'} text-sm`}
            aria-pressed={history}
            onClick={() => setHistory(true)}
          >
            History
          </button>
          <button
            className="px-4 py-2 clay-btn text-sm"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {query.isPending ? (
        <p role="status" className="p-4 text-slate-500 animate-pulse">
          Loading conversations…
        </p>
      ) : (
        <>
          {query.isError && (
            <div className="py-4">
              <ErrorState
                message={query.error.message}
                retry={() => {
                  void query.refetch();
                }}
              />
            </div>
          )}
          <nav aria-label="Choose a conversation" className="flex flex-col gap-4">
            {items.map((exchange) => {
              const books = givingAndReceiving(exchange, user!.id);
              const isSelected = selectedId === exchange.id;
              
              return (
                <Link
                  key={exchange.id}
                  className={`block p-4 ${isSelected ? 'clay-input' : 'clay-btn'}`}
                  href={`/messages/${exchange.id}`}
                  aria-current={isSelected ? "page" : undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-700">
                      {exchange.requester_id === user!.id
                        ? exchange.owner_name
                        : exchange.requester_name}
                    </h3>
                    <ExchangeStatusBadge status={exchange.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-700 font-medium">
                    {books.receiving.title}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    You offer {books.giving.title}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    Accepted {new Date(exchange.accepted_at!).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </nav>

          {!items.length && !query.isError && (
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm text-slate-500">
                {query.hasNextPage
                  ? "No matching conversations loaded yet. Check older exchanges below."
                  : history
                    ? "No closed conversations yet."
                    : "No active accepted exchanges yet."}
              </p>
              <ButtonLink variant="secondary" className="clay-btn px-6 py-2 mt-2" href="/exchanges">
                View exchanges
              </ButtonLink>
            </div>
          )}

          {query.hasNextPage && (
            <div className="pt-4">
              <button
                className="w-full clay-btn py-3 text-sm"
                disabled={query.isFetching}
                onClick={() => {
                  void query.fetchNextPage();
                }}
              >
                Load older conversations
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}