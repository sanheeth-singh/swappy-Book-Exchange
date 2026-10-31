"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { blockingApi } from "@/features/blocking/api";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { reportsApi } from "../api";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
export function SafetyScreen() {
  const [bo, setBo] = useState(0);
  const [ro, setRo] = useState(0);
  const blocks = useQuery({
    queryKey: ["blocks", bo],
    queryFn: () => blockingApi.list(bo),
  });
  const reports = useQuery({
    queryKey: ["reports", ro],
    queryFn: () => reportsApi.list(ro),
  });
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">Safety</h1>
      <p className="text-muted">
        Manage blocked readers and follow your reports. Report controls are on
        book listings and reader profiles.
      </p>
      <section className="space-y-3">
        <h2 className="text-2xl">Blocked readers</h2>
        {blocks.isPending ? (
          <p role="status">Loading blocks…</p>
        ) : blocks.isError ? (
          <ErrorState
            message={blocks.error.message}
            retry={() => {
              void blocks.refetch();
            }}
          />
        ) : blocks.data.length ? (
          blocks.data.map((item) => (
            <div className="card space-y-3 p-5" key={item.blocked_user_id}>
              <p className="break-all text-sm text-muted">
                Reader ID: {item.blocked_user_id}
              </p>
              <SafetyActions userId={item.blocked_user_id} unblock />
            </div>
          ))
        ) : (
          <p>No blocked readers.</p>
        )}
        <Pagination
          offset={bo}
          pageSize={20}
          hasMore={blocks.data?.length === 20}
          onChange={setBo}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Your reports</h2>
        {reports.isPending ? (
          <p role="status">Loading reports…</p>
        ) : reports.isError ? (
          <ErrorState
            message={reports.error.message}
            retry={() => {
              void reports.refetch();
            }}
          />
        ) : reports.data.length ? (
          reports.data.map((item) => (
            <article className="card space-y-3 p-5" key={item.id}>
              <h3>
                {item.target_type === "USER" ? "Reader" : "Listing"} report ·{" "}
                {item.status.toLowerCase()}
              </h3>
              <p className="text-sm text-muted">
                {new Date(item.created_at).toLocaleString()}
              </p>
              <ButtonLink
                variant="secondary"
                href={`/safety/reports/${item.id}`}
              >
                View report
              </ButtonLink>
            </article>
          ))
        ) : (
          <p>No reports submitted.</p>
        )}
        <Pagination
          offset={ro}
          pageSize={20}
          hasMore={reports.data?.length === 20}
          onChange={setRo}
        />
      </section>
    </div>
  );
}
