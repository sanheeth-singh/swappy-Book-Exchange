"use client";
import { ProtectedImagePreview } from "@/components/ui/protected-image-preview";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Schema } from "../api";
import { useAuth } from "@/features/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
export function MembershipReviewScreen() {
  const query = useQuery({
    queryKey: ["admin", "memberships"],
    queryFn: adminApi.queue,
  });
  return (
    <div>
      <p className="eyebrow">Enrollment review</p>
      <h1 className="mt-3 text-4xl">Verification queue.</h1>
      <p className="my-4 text-muted">
        Up to 100 pending submissions are returned by the backend. Process these
        and refresh to load the remaining queue.
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh queue
      </Button>
      {query.isPending ? (
        <p role="status">Loading submissions…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.length ? (
        <div className="mt-5 space-y-4">
          {query.data.map((item) => (
            <Review key={item.submission_id ?? item.user_id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No pending submissions"
          description="New enrollment submissions will appear here."
        />
      )}
    </div>
  );
}
function Review({ item }: { item: Schema["ReviewQueueResponse"] }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  async function download() {
    setError(undefined);
    try {
      const blob = await adminApi.proof(item.submission_id!);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        blob.type === "image/png"
          ? "enrollment-proof.png"
          : "enrollment-proof.jpg";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Document unavailable.",
      );
    }
  }
  return (
    <Card className="p-5">
      <h2 className="text-xl">{item.display_name}</h2>
      <p className="mt-2 break-all text-xs text-muted">
        Campus ID: {item.campus_id}
      </p>
      {item.submission_id && (
        <ProtectedImagePreview
          load={() => adminApi.proof(item.submission_id!)}
        />
      )}
      <Button
        className="my-4"
        variant="secondary"
        disabled={!item.submission_id}
        onClick={download}
      >
        Download proof
      </Button>
      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const decision = String(data.get("decision")) as
            | "VERIFIED"
            | "REJECTED";
          const reason = String(data.get("reason") ?? "").trim();
          const date = String(data.get("expires_at") ?? "");
          if (
            decision === "VERIFIED" &&
            (!date || new Date(date).getTime() <= Date.now())
          ) {
            setError("Approval requires a future enrollment expiry.");
            return;
          }
          if (decision === "REJECTED" && !reason) {
            setError("Explain why this submission is rejected.");
            return;
          }
          setPending(true);
          setError(undefined);
          try {
            await adminApi.review(item.submission_id!, {
              decision,
              reason: reason || null,
              expires_at:
                decision === "VERIFIED" ? new Date(date).toISOString() : null,
            });
            await client.invalidateQueries({
              queryKey: ["admin", "memberships"],
            });
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Review failed.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Decision
          <Select name="decision">
            <option value="VERIFIED">Approve verification</option>
            <option value="REJECTED">Reject submission</option>
          </Select>
        </label>
        <label>
          Enrollment expiry (required for approval, your local time)
          <Input type="datetime-local" name="expires_at" />
        </label>
        <label>
          Review reason (required for rejection)
          <Textarea name="reason" maxLength={500} />
        </label>
        <FormError message={error} />
        <Button
          type="submit"
          disabled={pending || !item.submission_id || user?.id === item.user_id}
        >
          {user?.id === item.user_id
            ? "Another administrator must review this"
            : pending
              ? "Recording decision…"
              : "Record decision"}
        </Button>
      </form>
    </Card>
  );
}
