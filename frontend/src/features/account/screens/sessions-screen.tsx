"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import { accountApi } from "../api";
import { SettingsNavigation } from "../components/settings-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/feedback/error-state";
import { FormError } from "@/components/feedback/form-error";
export function SessionsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const query = useQuery({
    queryKey: ["account", "sessions", offset],
    queryFn: () => accountApi.sessions(offset),
  });
  async function revoke(id?: string, current = false) {
    setPending(true);
    setError(undefined);
    try {
      if (id) await accountApi.revoke(id);
      else await accountApi.logoutAll();
      if (current || !id) {
        auth.endLocalSession();
        router.replace("/login");
      } else await query.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Session could not be revoked.",
      );
      throw e;
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <SettingsNavigation />
      <h1 className="text-4xl">Signed-in devices</h1>
      <p className="text-muted">
        Only live sessions are listed. Device labels come from the browser and
        may be approximate.
      </p>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh sessions
      </Button>
      <FormError message={error} />
      {query.isPending ? (
        <p role="status">Loading sessions…</p>
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
            {item.is_current && <Badge>This browser</Badge>}
            <h2 className="break-words text-base">
              {item.user_agent || "Unidentified browser"}
            </h2>
            <p className="text-sm text-muted">
              Signed in {new Date(item.created_at).toLocaleString()}
              <br />
              Last refreshed {new Date(item.last_refreshed_at).toLocaleString()}
              <br />
              Expires {new Date(item.expires_at).toLocaleString()}
            </p>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                useOverlayStore
                  .getState()
                  .openConfirmation({
                    title: item.is_current
                      ? "Sign out this browser?"
                      : "Revoke this session?",
                    description: item.is_current
                      ? "You will need to sign in again."
                      : "This device will need to sign in again. Existing exchanges are preserved.",
                    confirmLabel: "Revoke session",
                    destructive: true,
                    onConfirm: () => revoke(item.id, item.is_current),
                  })
              }
            >
              Revoke session
            </Button>
          </article>
        ))
      ) : (
        <p>No active sessions returned.</p>
      )}
      <Pagination
        offset={offset}
        pageSize={20}
        hasMore={query.data?.length === 20}
        onChange={setOffset}
      />
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          useOverlayStore
            .getState()
            .openConfirmation({
              title: "Sign out every device?",
              description:
                "This includes the current browser. You can sign in again with your password.",
              confirmLabel: "Sign out all devices",
              destructive: true,
              onConfirm: () => revoke(),
            })
        }
      >
        Sign out all devices
      </Button>
    </div>
  );
}
