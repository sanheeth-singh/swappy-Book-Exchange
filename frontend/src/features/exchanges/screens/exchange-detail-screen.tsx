"use client";
import { ExchangeActionBar } from "../components/exchange-action-bar";
import { ExchangeStatusBadge } from "../components/exchange-status-badge";
import { ExchangeReviewPanel } from "@/features/reviews/components/exchange-review-panel";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { exchangesApi, exchangeKeys } from "../api";
import { ExchangeSummary } from "../components/exchange-summary";
import { exchangeStatuses } from "@/features/help/content";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
export function ExchangeDetailScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [issueOffset, setIssueOffset] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: exchangeKeys.detail(id),
    queryFn: ({ signal }) => exchangesApi.detail(id, signal),
    refetchInterval: 30000,
  });
  const issues = useQuery({
    queryKey: ["exchanges", "issues", id, issueOffset],
    queryFn: () => exchangesApi.issues(id, issueOffset),
    enabled: query.isSuccess,
    refetchInterval: 30000,
  });
  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["exchanges"] }),
      client.invalidateQueries({ queryKey: ["books"] }),
      client.invalidateQueries({ queryKey: ["public-preview"] }),
      client.invalidateQueries({ queryKey: ["admin"] }),
    ]);
  }
  if (query.isPending) return <p role="status">Loading exchange…</p>;
  if (query.isError)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const exchange = query.data;
  const requester = exchange.requester_id === user!.id;
  const reserved = ["ACCEPTED", "WAITING_CONFIRMATION"].includes(
    exchange.status,
  );
  return (
    <div className="max-w-3xl space-y-5">
      <div className="section-heading">
        <div>
          <ExchangeStatusBadge status={exchange.status} />
          <h1 className="mt-3 text-3xl">
            Your exchange with{" "}
            {requester ? exchange.owner_name : exchange.requester_name}.
          </h1>
        </div>
        <ButtonLink href="/exchanges" variant="ghost">
          All exchanges
        </ButtonLink>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink
          variant="secondary"
          href={`/readers/${requester ? exchange.owner_id : exchange.requester_id}`}
        >
          View other reader
        </ButtonLink>
      </div>
      <ExchangeSummary exchange={exchange} userId={user!.id} />
      <p className="text-sm text-muted">
        {exchangeStatuses[exchange.status].description}
      </p>
      {exchange.expires_at && exchange.status === "ACCEPTED" && (
        <p className="help-note">
          Accepted-exchange deadline:{" "}
          {new Date(exchange.expires_at).toLocaleString()}. If neither
          participant confirms receipt, the backend can expire the exchange.
          This screen does not change status on a local timer.
        </p>
      )}
      {reserved && (
        <div className="card p-5">
          <h2 className="text-xl">Receipt confirmations</h2>
          <p className="mt-3">
            You:{" "}
            {(
              requester
                ? exchange.requester_confirmed
                : exchange.owner_confirmed
            )
              ? "Received"
              : "Not confirmed"}
          </p>
          <p>
            The other participant:{" "}
            {(
              requester
                ? exchange.owner_confirmed
                : exchange.requester_confirmed
            )
              ? "Received"
              : "Not confirmed"}
          </p>
          <p className="mt-3 text-sm text-muted">
            Confirm only after the other book is in your hands. Completion
            transfers ownership and archives both original listings.
          </p>
        </div>
      )}
      <ExchangeActionBar exchange={exchange} />
      <Button
        variant="ghost"
        onClick={() => {
          void invalidate();
        }}
      >
        Refresh status
      </Button>
      <FormError message={error} />
      {reserved && (
        <form
          id="handover-issue"
          className="card space-y-3 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const explanation = String(
              new FormData(form).get("explanation"),
            ).trim();
            if (explanation.length < 10) {
              setError("Explain the issue in at least 10 characters.");
              return;
            }
            setPending(true);
            setError(undefined);
            try {
              await exchangesApi.issue(id, explanation);
              form.reset();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Issue could not be submitted.",
              );
            } finally {
              await invalidate();
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl">Need help with this handover?</h2>
          <label htmlFor="issue-explanation" className="sr-only">
            What happened?
          </label>
          <Textarea
            id="issue-explanation"
            name="explanation"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            placeholder="Describe what happened and what needs resolving."
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            Submit an exchange issue
          </Button>
        </form>
      )}
      {exchange.accepted_at && (
        <ButtonLink href={`/messages/${id}`}>Open conversation</ButtonLink>
      )}
      {exchange.status === "COMPLETED" && <ExchangeReviewPanel id={id} />}
      <SafetyActions
        userId={requester ? exchange.owner_id : exchange.requester_id}
      />
      <section>
        <h2 className="text-xl">Issue history</h2>
        {issues.isPending ? (
          <p role="status">Loading issues…</p>
        ) : issues.isError ? (
          <ErrorState
            message={issues.error.message}
            retry={() => {
              void issues.refetch();
            }}
          />
        ) : (
          <>
            <div className="mt-3 space-y-3">
              {issues.data?.map((issue) => (
                <div key={issue.id} className="card p-4">
                  <Badge>{issue.status === "OPEN" ? "Open" : "Resolved"}</Badge>
                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {issue.explanation}
                  </p>
                </div>
              ))}
            </div>
            {issues.data?.length === 0 && (
              <p className="mt-3 text-sm text-muted">
                No issues have been raised.
              </p>
            )}
            <Pagination
              offset={issueOffset}
              pageSize={20}
              hasMore={issues.data?.length === 20}
              onChange={setIssueOffset}
            />
          </>
        )}
      </section>
      {exchange.resolution_reason && (
        <div className="help-note">
          Administrator resolution: {exchange.resolution_reason}
        </div>
      )}
      <ButtonLink href="/help#exchange-journey" variant="ghost">
        Read the exchange guide
      </ButtonLink>
    </div>
  );
}
