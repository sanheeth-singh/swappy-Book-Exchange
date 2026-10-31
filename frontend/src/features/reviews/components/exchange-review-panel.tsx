"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "../api";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
export function ExchangeReviewPanel({ id }: { id: string }) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const query = useQuery({
    queryKey: ["reviews", "exchange", id],
    queryFn: () => reviewsApi.exchange(id),
  });
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-2xl">Review this exchange</h2>
      <p className="text-sm text-muted">
        Reviews cannot be edited. They are published after both participants
        review or the review window closes.
      </p>
      {query.isPending ? (
        <p role="status">Loading reviews…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          {query.data.review_deadline && (
            <p className="text-sm text-muted">
              Review deadline:{" "}
              {new Date(query.data.review_deadline).toLocaleString()}
            </p>
          )}
          {query.data.my_review ? (
            <div>
              <h3>Your review · {query.data.my_review.rating}/5</h3>
              <p className="whitespace-pre-wrap break-words">
                {query.data.my_review.comment}
              </p>
              <p className="text-sm text-muted">
                {query.data.my_review.is_hidden
                  ? "Hidden by moderation"
                  : query.data.my_review.published_at
                    ? "Published"
                    : "Awaiting publication"}
              </p>
            </div>
          ) : query.data.can_review ? (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setPending(true);
                setError(undefined);
                try {
                  await reviewsApi.submit(id, {
                    rating: Number(data.get("rating")),
                    comment: String(data.get("comment")).trim() || null,
                  });
                  await Promise.all([
                    client.invalidateQueries({ queryKey: ["reviews"] }),
                    client.invalidateQueries({ queryKey: ["reputation"] }),
                  ]);
                } catch (f) {
                  setError(
                    f instanceof Error
                      ? f.message
                      : "Review could not be submitted. Refresh before retrying.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              <label>
                Rating
                <Select name="rating" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} out of 5
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                Comment (optional)
                <Textarea name="comment" maxLength={2000} rows={3} />
              </label>
              <Button type="submit" disabled={pending}>
                Submit review
              </Button>
            </form>
          ) : (
            <p>The review window is closed.</p>
          )}
          {query.data.received_review ? (
            <div className="help-note">
              <h3>
                Review you received · {query.data.received_review.rating}/5
              </h3>
              <p className="whitespace-pre-wrap break-words">
                {query.data.received_review.comment}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              No published review received yet.
            </p>
          )}
        </>
      )}
      <FormError message={error} />
    </section>
  );
}
