"use client";
import { useState } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/feedback/form-error";
export function ReasonActionForm({
  choices,
  description,
  onSubmit,
  disabled = false,
}: {
  choices: { value: string; label: string }[];
  description: string;
  onSubmit: (action: string, reason: string) => Promise<string | void>;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const action = String(data.get("action"));
        const reason = String(data.get("reason")).trim();
        setError(undefined);
        setNotice(undefined);
        if (reason.length < 10) {
          setError("Explain the decision in at least 10 characters.");
          return;
        }
        const choice = choices.find((c) => c.value === action);
        if (!choice) return;
        useOverlayStore.getState().openConfirmation({
          title: `${choice.label}?`,
          description,
          confirmLabel: choice.label,
          destructive: true,
          onConfirm: async () => {
            setPending(true);
            try {
              const message = await onSubmit(action, reason);
              form.reset();
              setNotice(message ?? "Decision recorded.");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Decision could not be recorded.",
              );
              throw e;
            } finally {
              setPending(false);
            }
          },
        });
      }}
    >
      <label className="block">
        Action
        <Select name="action" disabled={disabled || pending}>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        Reason or review summary
        <Textarea
          name="reason"
          required
          minLength={10}
          maxLength={1000}
          rows={3}
          disabled={disabled || pending}
        />
      </label>
      <FormError message={error} />
      {notice && (
        <p role="status" className="help-note">
          {notice}
        </p>
      )}
      <Button type="submit" disabled={disabled || pending || !choices.length}>
        Record decision
      </Button>
    </form>
  );
}
