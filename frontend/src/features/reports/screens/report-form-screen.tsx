"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { reportsApi, reportPayload, type ReportInput } from "../api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/feedback/form-error";
export function ReportFormScreen({ type, id }: { type: string; id: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-4xl">Report a concern</h1>
      <p className="text-muted">
        Reports go to administrators. For an active handover problem, use the
        issue form in your exchange.
      </p>
      <form
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          setPending(true);
          const data = new FormData(e.currentTarget);
          try {
            const payload = reportPayload(
              type,
              id,
              String(data.get("reason")) as ReportInput["reason"],
              String(data.get("details")),
            );
            const report = await reportsApi.create(payload);
            await client.invalidateQueries({ queryKey: ["reports"] });
            router.push(`/safety/reports/${report.id}`);
          } catch (f) {
            setError(
              f instanceof Error ? f.message : "Report could not be submitted.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <p>Reporting: {type === "LISTING" ? "book listing" : "reader"}</p>
        <label className="block">
          Reason
          <Select name="reason">
            <option value="SPAM">Spam</option>
            <option value="HARASSMENT">Harassment</option>
            <option value="INAPPROPRIATE_CONTENT">Inappropriate content</option>
            <option value="MISLEADING_LISTING">Misleading listing</option>
            <option value="OTHER">Other</option>
          </Select>
        </label>
        <label className="block">
          Details
          <Textarea
            name="details"
            maxLength={2000}
            rows={5}
            placeholder="Explain the concern. Other requires at least 10 characters."
          />
        </label>
        <FormError message={error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit report"}
        </Button>
      </form>
      <ButtonLink variant="secondary" href="/safety">
        Back to Safety
      </ButtonLink>
    </div>
  );
}
