"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOverlayStore } from "@/stores/overlay-store";
import { blockingApi } from "../api";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
export function SafetyActions({
  userId,
  unblock = false,
}: {
  userId: string;
  unblock?: boolean;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            useOverlayStore.getState().openConfirmation({
              title: unblock ? "Unblock reader?" : "Block reader?",
              description: unblock
                ? "This reader can interact with you again if other participation rules allow it."
                : "This prevents new interactions and rejects pending proposals between you. Existing accepted exchanges still require handover or resolution; blocking does not cancel them.",
              confirmLabel: unblock ? "Unblock reader" : "Block reader",
              destructive: !unblock,
              onConfirm: async () => {
                setPending(true);
                setError(undefined);
                setNotice(undefined);
                try {
                  if (unblock) await blockingApi.unblock(userId);
                  else await blockingApi.block(userId);
                  await Promise.all(
                    ["blocks", "books", "exchanges", "chat", "reader"].map(
                      (key) => client.invalidateQueries({ queryKey: [key] }),
                    ),
                  );
                  setNotice(
                    unblock
                      ? "Reader unblocked."
                      : "Reader blocked. Manage blocks in Safety.",
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Action failed.");
                  throw e;
                } finally {
                  setPending(false);
                }
              },
            })
          }
        >
          {unblock ? "Unblock reader" : "Block reader"}
        </Button>
        {!unblock && (
          <ButtonLink
            variant="ghost"
            href={`/safety/report?type=USER&id=${encodeURIComponent(userId)}`}
          >
            Report reader
          </ButtonLink>
        )}
      </div>
      <FormError message={error} />
      {notice && (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
