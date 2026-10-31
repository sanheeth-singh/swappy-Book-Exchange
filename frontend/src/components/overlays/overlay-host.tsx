"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import { useToastStore } from "@/stores/toast-store";
import { Button } from "@/components/ui/button";
export function OverlayHost() {
  const { confirmation, close } = useOverlayStore();
  const [pending, setPending] = useState(false);
  async function confirm() {
    if (!confirmation || pending) return;
    setPending(true);
    try {
      await confirmation.onConfirm();
      close();
    } catch (error) {
      useToastStore
        .getState()
        .show(
          error instanceof Error
            ? error.message
            : "The action could not be completed. Please try again.",
          "error",
        );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog.Root
      open={Boolean(confirmation)}
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content card"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <Dialog.Title className="text-xl font-semibold">
            {confirmation?.title}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-muted">
            {confirmation?.description}
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant={confirmation?.destructive ? "danger" : "primary"}
              disabled={pending}
              onClick={confirm}
            >
              {pending ? "Please wait…" : confirmation?.confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
