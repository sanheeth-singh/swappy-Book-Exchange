"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { moderationApi } from "../api";
import type { ReportDecision } from "../types";
import { reportActions, reportActionLabels } from "../policies";
import { ModerationNavigation } from "../components/moderation-navigation";
import { ReasonActionForm } from "../components/reason-action-form";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/error-state";
export function ReportScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["moderation", "report", id],
    queryFn: () => moderationApi.report(id),
  });
  async function refresh() {
    await Promise.all(
      [
        "moderation",
        "reports",
        "books",
        "exchanges",
        "reader",
        "notifications",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  }
  if (query.isPending) return <p role="status">Loading report…</p>;
  if (query.isError)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const report = query.data;
  const choices = reportActions(report, user!.id);
  const conflict = [report.reporter_id, report.target_user_id].includes(
    user!.id,
  );
  return (
    <div className="max-w-3xl space-y-5">
      <ModerationNavigation />
      <h1 className="text-4xl">Inspect safety report</h1>
      <Badge>{report.status.toLowerCase()}</Badge>
      <article className="card space-y-4 p-5">
        <h2 className="text-2xl">Reported concern</h2>
        <p className="capitalize">
          {report.reason.toLowerCase().replaceAll("_", " ")}
        </p>
        <p className="whitespace-pre-wrap break-words">
          {report.details || "No additional details."}
        </p>
        <p className="break-all text-xs text-muted">
          Reporter: {report.reporter_id}
          <br />
          Target reader: {report.target_user_id}
          {report.listing_id && (
            <>
              <br />
              Listing: {report.listing_id}
            </>
          )}
          <br />
          Submitted {new Date(report.created_at).toLocaleString()}
        </p>
        <details className="disclosure">
          <summary>Evidence snapshot at submission</summary>
          <dl className="definition-list p-4">
            {Object.entries(report.target_snapshot)
              .filter(
                ([key, value]) =>
                  [
                    "title",
                    "author",
                    "description",
                    "condition",
                    "display_name",
                    "id",
                    "owner_id",
                    "campus_id",
                    "condition_notes",
                  ].includes(key) && value !== null,
              )
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="capitalize">{key.replaceAll("_", " ")}</dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {String(value)}
                  </dd>
                </div>
              ))}
          </dl>
        </details>
        {report.review_summary && (
          <div className="help-note">
            <h3>
              {report.action
                ? reportActionLabels[report.action]
                : "Review summary"}
            </h3>
            <p className="mt-2 whitespace-pre-wrap break-words">
              {report.review_summary}
            </p>
            {report.reviewed_at && (
              <p className="mt-2 text-xs text-muted">
                Recorded {new Date(report.reviewed_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </article>
      {choices.length > 0 ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-2xl">Record review</h2>
          <p className="text-sm text-muted">
            Hiding a listing or restricting participation rejects affected
            pending proposals. Accepted exchanges and support paths remain
            available.
          </p>
          <ReasonActionForm
            choices={choices.map((value) => ({
              value,
              label: reportActionLabels[value],
            }))}
            description="This decision is audited and will update the report. Restrictions affect new participation; existing accepted exchanges remain actionable."
            onSubmit={async (action, summary) => {
              await moderationApi.decide(id, {
                action: action as ReportDecision["action"],
                summary,
              });
              await refresh();
            }}
          />
        </section>
      ) : conflict ? (
        <p className="help-note">
          Another administrator must handle this report.
        </p>
      ) : (
        <p>This report has already been reviewed.</p>
      )}
      {!conflict &&
        report.status !== "OPEN" &&
        (report.action === "RESTRICT_USER" ||
          report.action === "HIDE_LISTING") && (
          <section className="card space-y-4 p-5">
            <h2 className="text-2xl">Restore access</h2>
            <p className="text-sm text-muted">
              Restoration does not reopen rejected proposals, undo archival, or
              change campus verification.
            </p>
            <ReasonActionForm
              choices={[
                {
                  value: report.action,
                  label:
                    report.action === "HIDE_LISTING"
                      ? "Restore listing visibility"
                      : "Restore participation",
                },
              ]}
              description="Restore only the moderation restriction. Other account, campus and listing rules continue to apply."
              onSubmit={async (action, reason) => {
                const result =
                  action === "HIDE_LISTING"
                    ? await moderationApi.restoreListing(
                        report.listing_id!,
                        reason,
                      )
                    : await moderationApi.restoreUser(
                        report.target_user_id,
                        reason,
                      );
                await refresh();
                return result.changed
                  ? "Access restored. The action is recorded in history."
                  : "No change: this moderation restriction was already lifted.";
              }}
            />
          </section>
        )}
      <ButtonLink variant="secondary" href="/admin/moderation/reports">
        Back to reports
      </ButtonLink>
    </div>
  );
}
