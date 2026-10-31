"use client";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
export function DashboardScreen() {
  const queue = useQuery({
    queryKey: ["admin", "memberships"],
    queryFn: adminApi.queue,
  });
  const issues = useQuery({
    queryKey: ["admin", "issues", 0],
    queryFn: () => adminApi.issues(),
  });
  return (
    <div>
      <p className="eyebrow">Administrator workspace</p>
      <h1 className="mt-3 text-4xl">Campus operations.</h1>
      <p className="mt-4 text-muted">
        Review enrollment, manage the directory and resolve exchange issues.
        Administrator access does not require a student profile or campus
        verification.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl">Verification queue</h2>
          {queue.isPending ? (
            <p role="status">Loading…</p>
          ) : queue.isError ? (
            <ErrorState
              message={queue.error.message}
              retry={() => {
                void queue.refetch();
              }}
            />
          ) : (
            <p className="my-4 text-3xl font-semibold">
              {queue.data.length}
              {queue.data.length === 100 ? "+" : ""}
              <span className="ml-2 text-sm text-muted">
                pending in the returned queue
              </span>
            </p>
          )}
          <ButtonLink href="/admin/memberships" variant="secondary">
            Review submissions
          </ButtonLink>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl">Exchange issues</h2>
          {issues.isPending ? (
            <p role="status">Loading…</p>
          ) : issues.isError ? (
            <ErrorState
              message={issues.error.message}
              retry={() => {
                void issues.refetch();
              }}
            />
          ) : (
            <p className="my-4 text-3xl font-semibold">
              {issues.data.length}
              {issues.data.length === 20 ? "+" : ""}
              <span className="ml-2 text-sm text-muted">
                open issues in the first page
              </span>
            </p>
          )}
          <ButtonLink href="/admin/issues" variant="secondary">
            Open issue desk
          </ButtonLink>
        </Card>
      </div>
      <Card className="mt-5 p-6">
        <h2 className="text-xl">Safety and moderation</h2>
        <p className="my-3 text-muted">
          Inspect reports, moderate published reviews and audit previous
          actions.
        </p>
        <ButtonLink variant="secondary" href="/admin/moderation/reports">
          Open moderation desk
        </ButtonLink>
      </Card>
      <Card className="mt-5 p-6">
        <h2 className="text-xl">Directory administration</h2>
        <p className="my-3 text-muted">
          Create or update colleges and campuses. Review impact before
          activating or deactivating a directory entry, and inspect the audit
          history.
        </p>
        <ButtonLink href="/admin/directory">Manage directory</ButtonLink>
      </Card>
    </div>
  );
}
