"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/error-state";
export function ReportDetailScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["reports", "detail", id],
    queryFn: () => reportsApi.detail(id),
    refetchInterval: 30000,
  });
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
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-4xl">Your report</h1>
      <Badge>{report.status.toLowerCase()}</Badge>
      <div className="card space-y-3 p-5">
        <p>Reason: {report.reason.toLowerCase().replaceAll("_", " ")}</p>
        <p className="whitespace-pre-wrap break-words">
          {report.details || "No additional details."}
        </p>
        <p className="text-sm text-muted">
          Submitted {new Date(report.created_at).toLocaleString()}
        </p>
        {report.review_summary && (
          <p className="help-note whitespace-pre-wrap break-words">
            Administrator response: {report.review_summary}
          </p>
        )}
      </div>
      <ButtonLink variant="secondary" href="/safety">
        Back to Safety
      </ButtonLink>
    </div>
  );
}
