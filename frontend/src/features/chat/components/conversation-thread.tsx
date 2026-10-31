"use client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { exchangesApi, exchangeKeys } from "@/features/exchanges/api";
import { ExchangeActionBar } from "@/features/exchanges/components/exchange-action-bar";
import { ExchangeStatusBadge } from "@/features/exchanges/components/exchange-status-badge";
import { ExchangeSummary } from "@/features/exchanges/components/exchange-summary";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { canOpenConversation, activeConversation } from "../conversations";
import { ChatPanel } from "./chat-panel";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";

export function ConversationThread({ id }: { id: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: exchangeKeys.detail(id),
    queryFn: ({ signal }) => exchangesApi.detail(id, signal),
    refetchInterval: 15000,
  });

  if (query.isPending)
    return (
      <div className="clay-card p-8 flex items-center justify-center min-h-[300px]">
        <p role="status" className="text-slate-500 animate-pulse font-medium">
          Loading exchange conversation…
        </p>
      </div>
    );

  if (query.isError)
    return (
      <div className="clay-card p-8">
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      </div>
    );

  const exchange = query.data;

  if (!canOpenConversation(exchange, user!.id))
    return (
      <div className="clay-card space-y-4 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e6eaf0] flex items-center justify-center shadow-[inset_4px_4px_8px_rgba(163,177,198,0.7),inset_-4px_-4px_8px_rgba(255,255,255,0.9)] text-2xl">
          🔒
        </div>
        <h2 className="text-2xl font-bold text-slate-700">Chat is not available yet</h2>
        <p className="text-slate-500">Conversations open only after the exchange is accepted.</p>
        <div className="pt-4">
          <ButtonLink variant="secondary" className="clay-btn px-6 py-2" href={`/exchanges/${id}`}>
            View exchange
          </ButtonLink>
        </div>
      </div>
    );

  const requester = exchange.requester_id === user!.id;
  const otherId = requester ? exchange.owner_id : exchange.requester_id;
  const ownConfirmed = requester
    ? exchange.requester_confirmed
    : exchange.owner_confirmed;

  return (
    <>
      <header className="clay-card p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">
              {requester ? exchange.owner_name : exchange.requester_name}
            </h2>
            <div className="mt-3">
              <ExchangeStatusBadge status={exchange.status} />
            </div>
          </div>
          <ButtonLink variant="secondary" className="clay-btn px-4 py-2 text-sm" href={`/exchanges/${id}`}>
            View exchange
          </ButtonLink>
        </div>

        <div className="p-4 rounded-2xl bg-[#e6eaf0] shadow-[inset_4px_4px_8px_rgba(163,177,198,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.7)]">
          <p className="text-sm font-medium text-slate-600">
            {exchange.status === "ACCEPTED"
              ? "Arrange your handover here. Confirm receipt only after the book is in your hands."
              : exchange.status === "WAITING_CONFIRMATION"
                ? ownConfirmed
                  ? "You confirmed receipt. Waiting for the other reader to confirm."
                  : "The other reader confirmed receipt. Confirm once you have your book."
                : "This exchange is closed. Your conversation remains available as read-only history."}
          </p>
        </div>

        <ExchangeActionBar exchange={exchange} />

        <div className="flex flex-wrap items-start gap-4 pt-2">
          <ButtonLink variant="secondary" className="clay-btn px-4 py-2 text-sm" href={`/readers/${otherId}`}>
            View other reader
          </ButtonLink>
          <details className="group">
            <summary className="clay-btn px-4 py-2 text-sm cursor-pointer list-none flex items-center gap-2">
              Support & safety <span className="transition group-open:rotate-180">▼</span>
            </summary>
            <div className="space-y-3 p-4 mt-3 rounded-2xl shadow-[inset_4px_4px_8px_rgba(163,177,198,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.7)]">
              {activeConversation(exchange) && (
                <ButtonLink
                  variant="ghost"
                  className="block text-sm text-blue-600 font-medium"
                  href={`/exchanges/${id}#handover-issue`}
                >
                  Raise a handover issue
                </ButtonLink>
              )}
              <SafetyActions userId={otherId} />
            </div>
          </details>

          <details className="group">
            <summary className="clay-btn px-4 py-2 text-sm cursor-pointer list-none flex items-center gap-2">
              Books in this exchange <span className="transition group-open:rotate-180">▼</span>
            </summary>
            <div className="p-4 mt-3 rounded-2xl shadow-[inset_4px_4px_8px_rgba(163,177,198,0.4),inset_-4px_-4px_8px_rgba(255,255,255,0.7)]">
              <ExchangeSummary exchange={exchange} userId={user!.id} />
            </div>
          </details>
        </div>
      </header>

      <ChatPanel
        key={id}
        id={id}
        active={activeConversation(exchange)}
        embedded
      />
    </>
  );
}