"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { getMembership, submitProof } from "../api";
import { protectedRequest } from "@/features/auth/session";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImagePicker } from "@/components/ui/image-picker";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { membershipStatuses } from "@/features/help/content";
import { validateProof } from "../validation";
export function MembershipScreen() {
  const { user } = useAuth();
  const complete = !!user?.display_name && !!user.campus_id;
  const query = useQuery({
    queryKey: ["membership", user?.id],
    queryFn: getMembership,
    enabled: complete,
    retry: false,
  });
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  async function upload(file: File) {
    setNotice(undefined);
    await submitProof(file);
    await query.refetch();
    setNotice("Proof submitted for review.");
  }
  async function check() {
    setError(undefined);
    try {
      await protectedRequest({ url: "/membership/eligibility" });
      setNotice(
        "Your campus verification is currently eligible. Other account and listing rules may still apply.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Eligibility unavailable.",
      );
    }
  }
  const membership = query.data;
  const expired = membership?.expires_at
    ? new Date(membership.expires_at).getTime() <= query.dataUpdatedAt
    : false;
  const canSubmit =
    membership?.active &&
    membership.status !== "PENDING" &&
    membership.status !== "REVOKED" &&
    (membership.status !== "VERIFIED" || expired);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="eyebrow">Campus verification</p>
        <h1 className="mt-3 text-4xl">Ready to take part?</h1>
        <p className="mt-4 text-muted">
          Submit enrollment proof for manual review before listing books or
          proposing an exchange.
        </p>
      </div>
      {!complete ? (
        <Card className="p-6">
          <p>Complete your name and campus first.</p>
          <ButtonLink href="/profile" className="mt-4">
            Complete profile
          </ButtonLink>
        </Card>
      ) : query.isPending ? (
        <p role="status">Loading your membership…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        membership && (
          <>
            <Card className="space-y-4 p-6">
              <Badge>
                {membership.status in membershipStatuses
                  ? membershipStatuses[
                      membership.status as keyof typeof membershipStatuses
                    ].label
                  : membership.status}
              </Badge>
              {membership.expires_at && (
                <p>
                  Verification expiry:{" "}
                  {new Date(membership.expires_at).toLocaleDateString()}
                </p>
              )}
              {membership.review_reason && (
                <p className="text-sm text-muted">
                  Review reason: {membership.review_reason}
                </p>
              )}
              {!membership.active && (
                <p>
                  Membership is inactive. Contact your campus administrator.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  Refresh status
                </Button>
                <Button variant="ghost" onClick={check}>
                  Check verification eligibility
                </Button>
              </div>
            </Card>
            {canSubmit && (
              <Card className="p-6">
                <ImagePicker
                  accept="image/jpeg,image/png"
                  validate={validateProof}
                  onUpload={upload}
                  label="College ID or enrollment image"
                  uploadLabel="Submit for review"
                />
                <p className="mt-3 text-sm text-muted">
                  JPEG or PNG, up to 5 MiB. Proof is available only to
                  authorized reviewers and is removed after review or expiry
                  processing.
                </p>
              </Card>
            )}
          </>
        )
      )}
      <FormError message={error} />
      {notice && (
        <p role="status" className="help-note">
          {notice}
        </p>
      )}
      <ButtonLink href="/help#membership" variant="ghost">
        Read the verification guide
      </ButtonLink>
    </div>
  );
}
