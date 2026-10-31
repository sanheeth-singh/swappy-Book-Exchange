"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import { exchangesApi } from "../api";
import { exchangeActions, givingAndReceiving } from "../policies";
import { useOpenIssues } from "../hooks/use-open-issues";
import type { Exchange, ExchangeAction } from "../types";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
const labels: Record<ExchangeAction, string> = {
  accept: "Accept exchange",
  reject: "Reject proposal",
  cancel: "Cancel exchange",
  confirm: "I received the book",
};
export function ExchangeActionBar({ exchange }: { exchange: Exchange }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const active = ["ACCEPTED", "WAITING_CONFIRMATION"].includes(exchange.status);
  const issues = useOpenIssues(exchange.id, active);
  const actions = exchangeActions(exchange, user!.id, issues.data !== false);
  return (
    <div className="space-y-3">
      {active && issues.isError && (
        <ErrorState
          message={issues.error.message}
          retry={() => {
            void issues.refetch();
          }}
        />
      )}
      {active && issues.data === true && (
        <p className="help-note">
          An open handover issue needs administrator resolution before receipt
          can be confirmed.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            disabled={pending}
            variant={
              action === "confirm"
                ? "success"
                : action === "cancel" || action === "reject"
                  ? "danger-soft"
                  : "primary"
            }
            onClick={() =>
              useOverlayStore.getState().openConfirmation({
                title: `${labels[action]}?`,
                description:
                  action === "confirm"
                    ? `Confirm only after physically receiving “${givingAndReceiving(exchange, user!.id).receiving.title}”. Your confirmation cannot be undone as a normal cancellation.`
                    : action === "accept"
                      ? "Both books will be reserved and competing proposals rejected. Confirm receipt separately after the handover."
                      : "This closes the exchange without transferring ownership. Accepted exchanges cannot be cancelled after the first receipt confirmation.",
                confirmLabel: labels[action],
                destructive: action === "cancel" || action === "reject",
                onConfirm: async () => {
                  setPending(true);
                  setError(undefined);
                  try {
                    await exchangesApi.act(exchange.id, action);
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Action could not be completed.",
                    );
                    throw failure;
                  } finally {
                    await Promise.all(
                      [
                        "exchanges",
                        "books",
                        "public-preview",
                        "admin",
                        "chat",
                        "notifications",
                      ].map((key) =>
                        client.invalidateQueries({ queryKey: [key] }),
                      ),
                    );
                    setPending(false);
                  }
                },
              })
            }
          >
            {labels[action]}
          </Button>
        ))}
      </div>
      <FormError message={error} />
    </div>
  );
}
