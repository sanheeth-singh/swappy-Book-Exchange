"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useToastStore } from "@/stores/toast-store";
import { accountApi } from "../api";
import { SettingsNavigation } from "../components/settings-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
export function AccountScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const eligibility = useQuery({
    queryKey: ["account", "deactivation"],
    queryFn: accountApi.eligibility,
  });
  function end(message: string) {
    auth.endLocalSession();
    useToastStore.getState().show(message);
    router.replace("/login");
  }
  return (
    <div className="max-w-2xl space-y-5">
      <SettingsNavigation />
      <h1 className="text-4xl">Account security</h1>
      <FormError message={error} />
      <form
        className="card space-y-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const current_password = String(data.get("current_password"));
          const new_password = String(data.get("new_password"));
          setError(undefined);
          if (new_password !== data.get("confirm_password")) {
            setError("The new passwords do not match.");
            return;
          }
          if (current_password === new_password) {
            setError("Choose a different password.");
            return;
          }
          setPending(true);
          try {
            await accountApi.password({ current_password, new_password });
            form.reset();
            end("Password changed. Sign in again on your devices.");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Password could not be changed.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-2xl">Change password</h2>
        <p className="text-sm text-muted">
          Changing your password revokes all sessions, including this browser.
        </p>
        <label className="block">
          Current password
          <Input
            type="password"
            name="current_password"
            autoComplete="current-password"
            required
            minLength={1}
            maxLength={128}
          />
        </label>
        <label className="block">
          New password
          <Input
            type="password"
            name="new_password"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={128}
          />
        </label>
        <label className="block">
          Confirm new password
          <Input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            required
            minLength={4}
            maxLength={128}
          />
        </label>
        <Button type="submit" disabled={pending}>
          Change password and sign out
        </Button>
      </form>
      <section className="card space-y-4 p-5">
        <h2 className="text-2xl">Deactivate account</h2>
        <p className="text-sm text-muted">
          Deactivation archives your listings, disables membership, removes
          pending ID evidence and signs out every device. Exchange and support
          records remain. This screen does not offer self-service reactivation.
        </p>
        {eligibility.isPending ? (
          <p role="status">Checking active exchanges…</p>
        ) : eligibility.isError ? (
          <ErrorState
            message={eligibility.error.message}
            retry={() => {
              void eligibility.refetch();
            }}
          />
        ) : (
          <>
            <p className="help-note">
              Unsettled exchanges: {eligibility.data.pending} pending,{" "}
              {eligibility.data.accepted} accepted,{" "}
              {eligibility.data.waiting_confirmation} awaiting confirmation.
            </p>
            {!eligibility.data.can_deactivate ? (
              <p>Settle these exchanges before deactivating.</p>
            ) : (
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const current_password = String(
                    new FormData(form).get("current_password"),
                  );
                  setPending(true);
                  setError(undefined);
                  try {
                    await accountApi.deactivate({ current_password });
                    form.reset();
                    end("Your account has been deactivated.");
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Account could not be deactivated.",
                    );
                    void eligibility.refetch();
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <label className="block">
                  Confirm current password
                  <Input
                    type="password"
                    name="current_password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                  />
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required className="mt-1" />I
                  understand that my listings will be archived and I will lose
                  access to this account.
                </label>
                <Button variant="danger" type="submit" disabled={pending}>
                  Deactivate my account
                </Button>
              </form>
            )}
          </>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void eligibility.refetch();
          }}
        >
          Recheck eligibility
        </Button>
      </section>
    </div>
  );
}
