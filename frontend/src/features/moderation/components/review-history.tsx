"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { moderationApi } from "../api";
import { AuditTrail } from "./audit-trail";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
export function ReviewHistory({ id }: { id: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["moderation", "review-history", id, offset],
    queryFn: () => moderationApi.reviewActions(id, offset),
  });
  return (
    <div className="mt-4 space-y-3">
      {query.isPending ? (
        <p role="status">Loading review history…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <AuditTrail
          items={query.data.map((item) => ({
            id: item.id,
            action: item.action,
            note: item.reason,
            actorId: item.actor_id,
            date: item.created_at,
          }))}
        />
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
