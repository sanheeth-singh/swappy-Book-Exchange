"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { moderationApi } from "../api";
import type { Report } from "../types";
import { ModerationNavigation } from "../components/moderation-navigation";
import { Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/feedback/error-state";
export function ReportsScreen() {
  const [status, setStatus] = useState<Report["status"]>("OPEN");
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["moderation", "reports", status, offset],
    queryFn: () => moderationApi.reports(status, offset),
  });
  return (
    <div className="max-w-4xl space-y-5">
      <ModerationNavigation />
      <h1 className="text-4xl">Safety reports</h1>
      <p className="text-muted">
        Review concerns independently. Administrators cannot decide reports they
        submitted or reports about themselves.
      </p>
      <label className="block max-w-xs">
        Report status
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Report["status"]);
            setOffset(0);
          }}
        >
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh reports
      </Button>
      {query.isPending ? (
        <p role="status">Loading reports…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.length ? (
        query.data.map((item) => (
          <article key={item.id} className="card space-y-3 p-5">
            <Badge>{item.status.toLowerCase()}</Badge>
            <h2 className="text-xl">
              {item.target_type === "LISTING" ? "Listing" : "Reader"} ·{" "}
              {item.reason.toLowerCase().replaceAll("_", " ")}
            </h2>
            <p className="line-clamp-3 whitespace-pre-wrap break-words">
              {item.details}
            </p>
            <p className="text-xs text-muted">
              Submitted {new Date(item.created_at).toLocaleString()}
            </p>
            <ButtonLink
              variant="secondary"
              href={`/admin/moderation/reports/${item.id}`}
            >
              Inspect report
            </ButtonLink>
          </article>
        ))
      ) : (
        <p className="help-note">No reports in this queue.</p>
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
