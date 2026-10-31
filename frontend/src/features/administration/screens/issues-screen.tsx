"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Schema } from "../api";
import { useAuth } from "@/features/auth/auth-provider";
import { ExchangeBookSummaryCard } from "@/components/cards/exchange-book-summary";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
import { EmptyState } from "@/components/feedback/empty-state";
export function IssuesScreen() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["admin", "issues", offset],
    queryFn: () => adminApi.issues(offset),
  });
  return (
    <div>
      <p className="eyebrow">Handover support</p>
      <h1 className="mt-3 text-4xl">Exchange issues.</h1>
      {query.isPending ? (
        <p role="status">Loading open issues…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <div className="mt-6 space-y-4">
            {query.data.map((item) => (
              <Issue key={item.id} item={item} />
            ))}
          </div>
          {!query.data.length && (
            <EmptyState
              title="No open issues"
              description="Unresolved handover issues appear here."
            />
          )}
          <Pagination
            offset={offset}
            pageSize={20}
            hasMore={query.data.length === 20}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
function Issue({ item }: { item: Schema["IssueResponse"] }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const exchange = useQuery({
    queryKey: ["admin", "exchange", item.exchange_id],
    queryFn: () => adminApi.exchange(item.exchange_id),
    enabled: open,
  });
  const own =
    exchange.data &&
    [exchange.data.requester_id, exchange.data.owner_id].includes(user!.id);
  return (
    <Card className="p-5">
      <p className="whitespace-pre-wrap break-words">{item.explanation}</p>
      <p className="mt-2 text-xs text-muted">
        {new Date(item.created_at).toLocaleString()}
      </p>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close review" : "Review exchange"}
      </Button>
      {open && (
        <div className="mt-5">
          {exchange.isPending ? (
            <p role="status">Loading exchange…</p>
          ) : exchange.isError ? (
            <ErrorState
              message={exchange.error.message}
              retry={() => {
                void exchange.refetch();
              }}
            />
          ) : (
            exchange.data && (
              <>
                <p className="mb-4 text-sm">
                  Status: {exchange.data.status.replaceAll("_", " ")} ·{" "}
                  {exchange.data.requester_name} / {exchange.data.owner_name}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ExchangeBookSummaryCard
                    label="Requested book"
                    book={exchange.data.requested_snapshot}
                  />
                  <ExchangeBookSummaryCard
                    label="Offered book"
                    book={exchange.data.offered_snapshot}
                  />
                </div>
                <form
                  className="mt-5 grid gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    setPending(true);
                    setError(undefined);
                    try {
                      await adminApi.resolve(item.exchange_id, {
                        decision: String(data.get("decision")) as
                          | "COMPLETE"
                          | "CANCEL",
                        reason: String(data.get("reason")).trim(),
                      });
                      await client.invalidateQueries({ queryKey: ["admin"] });
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Resolution failed.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  <label>
                    Decision
                    <Select name="decision">
                      <option value="CANCEL">
                        Cancel without ownership transfer
                      </option>
                      <option value="COMPLETE">
                        Complete and transfer ownership
                      </option>
                    </Select>
                  </label>
                  <label>
                    Resolution reason
                    <Textarea
                      name="reason"
                      required
                      minLength={10}
                      maxLength={1000}
                    />
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input type="checkbox" required />I reviewed the handover
                    and the ownership effect of this decision.
                  </label>
                  <FormError message={error} />
                  <Button
                    type="submit"
                    disabled={
                      pending ||
                      own ||
                      !["ACCEPTED", "WAITING_CONFIRMATION"].includes(
                        exchange.data.status,
                      )
                    }
                  >
                    {own
                      ? "Another administrator must resolve this"
                      : pending
                        ? "Resolving…"
                        : "Record resolution"}
                  </Button>
                </form>
              </>
            )
          )}
        </div>
      )}
    </Card>
  );
}
