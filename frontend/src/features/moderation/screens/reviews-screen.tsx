"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { moderationApi } from "../api";
import type { Review } from "../types";
import { canModerateReview } from "../policies";
import { ModerationNavigation } from "../components/moderation-navigation";
import { ReasonActionForm } from "../components/reason-action-form";
import { ReviewHistory } from "../components/review-history";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
export function ReviewsScreen() {
  const [hidden, setHidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["moderation", "reviews", hidden, offset],
    queryFn: () => moderationApi.reviews(hidden, offset),
  });
  return (
    <div className="max-w-3xl space-y-5">
      <ModerationNavigation />
      <h1 className="text-4xl">Published reviews</h1>
      <p className="text-muted">
        Hiding a review removes it from public ratings and trust calculations.
        Restoration includes it again. Unpublished reviews are not exposed here.
      </p>
      <label className="block max-w-xs">
        Visibility
        <Select
          value={String(hidden)}
          onChange={(e) => {
            setHidden(e.target.value === "true");
            setOffset(0);
          }}
        >
          <option value="false">Visible reviews</option>
          <option value="true">Hidden reviews</option>
        </Select>
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh reviews
      </Button>
      {query.isPending ? (
        <p role="status">Loading reviews…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.length ? (
        query.data.map((item) => <ReviewCard key={item.id} item={item} />)
      ) : (
        <p className="help-note">No reviews in this queue.</p>
      )}
      <Pagination
        offset={offset}
        pageSize={20}
        hasMore={query.data?.length === 20}
        onChange={setOffset}
      />
    </div>
  );
}
function ReviewCard({ item }: { item: Review }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [history, setHistory] = useState(false);
  const allowed = canModerateReview(item, user!.id);
  return (
    <article className="card space-y-4 p-5">
      <h2 className="text-xl">
        Rating {item.rating}/5 · {item.is_hidden ? "Hidden" : "Visible"}
      </h2>
      <p className="whitespace-pre-wrap break-words">
        {item.comment || "No written comment."}
      </p>
      <p className="break-all text-xs text-muted">
        Reviewer: {item.reviewer_id}
        <br />
        Reviewed reader: {item.reviewed_user_id}
        <br />
        Exchange: {item.exchange_id}
      </p>
      {allowed ? (
        <ReasonActionForm
          choices={[
            {
              value: item.is_hidden ? "RESTORE" : "HIDE",
              label: item.is_hidden ? "Restore review" : "Hide review",
            },
          ]}
          description="This changes review visibility and reputation calculations. The reason is retained in the review audit history."
          onSubmit={async (action, reason) => {
            await moderationApi.moderate(item.id, {
              action: action as "HIDE" | "RESTORE",
              reason,
            });
            await Promise.all(
              [
                "moderation",
                "reviews",
                "reputation",
                "reader",
                "notifications",
              ].map((key) => client.invalidateQueries({ queryKey: [key] })),
            );
          }}
        />
      ) : (
        <p className="help-note">
          Another administrator must moderate this review.
        </p>
      )}
      <Button
        variant="ghost"
        aria-expanded={history}
        onClick={() => setHistory(!history)}
      >
        {history ? "Close audit history" : "Inspect audit history"}
      </Button>
      {history && <ReviewHistory id={item.id} />}
    </article>
  );
}
