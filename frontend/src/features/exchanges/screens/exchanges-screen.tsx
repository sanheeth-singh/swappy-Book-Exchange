"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { exchangesApi } from "../api";
import { ExchangeSummary } from "../components/exchange-summary";
import { Card } from "@/components/ui/card";
import { ExchangeStatusBadge } from "../components/exchange-status-badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
export function ExchangesScreen() {
  const { user } = useAuth();
  const [direction, setDirection] = useState<"sent" | "received">("received");
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["exchanges", direction, offset],
    queryFn: ({ signal }) => exchangesApi.list(direction, offset, signal),
  });
  return (
    <div>
      <p className="eyebrow">From proposal to handover</p>
      <h1 className="mt-3 text-4xl">Your exchanges.</h1>
      <div className="my-5 flex flex-wrap gap-3">
        {(["received", "sent"] as const).map((value) => (
          <Button
            key={value}
            variant={direction === value ? "primary" : "secondary"}
            aria-pressed={direction === value}
            onClick={() => {
              setDirection(value);
              setOffset(0);
            }}
          >
            {value === "received" ? "Received" : "Sent"}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={() => {
            void query.refetch();
          }}
        >
          Refresh
        </Button>
      </div>
      {query.isPending ? (
        <p role="status">Loading exchanges…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {query.data.map((exchange) => (
              <Card key={exchange.id} className="p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <ExchangeStatusBadge status={exchange.status} />
                  <p className="text-xs text-muted">
                    {user!.id === exchange.requester_id
                      ? exchange.owner_name
                      : exchange.requester_name}
                  </p>
                </div>
                <ExchangeSummary exchange={exchange} userId={user!.id} />
                <ButtonLink
                  className="mt-4"
                  variant="secondary"
                  href={`/exchanges/${exchange.id}`}
                >
                  View exchange
                </ButtonLink>
                {exchange.accepted_at && (
                  <ButtonLink
                    className="ml-2 mt-4"
                    href={`/messages/${exchange.id}`}
                  >
                    Chat
                  </ButtonLink>
                )}
              </Card>
            ))}
          </div>
          {!query.data.length && (
            <EmptyState
              title="No exchanges on this page"
              description={
                direction === "sent"
                  ? "Visit Discover to propose a book-for-book exchange."
                  : "Incoming proposals will appear here."
              }
              action={<ButtonLink href="/books">Discover books</ButtonLink>}
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
