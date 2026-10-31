"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { moderationApi } from "../api";
import { ModerationNavigation } from "../components/moderation-navigation";
import { AuditTrail } from "../components/audit-trail";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
export function ActionsScreen() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["moderation", "actions", offset],
    queryFn: () => moderationApi.actions(offset),
  });
  return (
    <div className="max-w-3xl space-y-5">
      <ModerationNavigation />
      <h1 className="text-4xl">Moderation action history</h1>
      <p className="text-muted">
        Report decisions and participation/listing restorations. Review
        visibility actions have their own history in Published reviews.
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh history
      </Button>
      {query.isPending ? (
        <p role="status">Loading actions…</p>
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
            note: item.note,
            actorId: item.actor_id,
            date: item.created_at,
            target: item.listing_id ?? item.target_user_id,
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
