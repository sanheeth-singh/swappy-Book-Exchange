"use client";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { notificationsApi, notificationLink } from "../api";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
export function NotificationsScreen() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const query = useInfiniteQuery({
    queryKey: ["notifications", "inbox"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
    refetchInterval: 20000,
  });
  const items = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.items) ?? []).map((n) => [n.id, n]),
    ).values(),
  ];
  async function mark(id: string, all = false) {
    setPending(true);
    setError(undefined);
    try {
      if (all) await notificationsApi.readAll(id);
      else await notificationsApi.read(id);
      await client.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not mark notifications read.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-4xl">Notifications</h1>
      <p className="text-muted">
        Exchange updates, campus verification and account activity.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void query.refetch();
          }}
        >
          Refresh
        </Button>
        <Button
          variant="ghost"
          disabled={pending || !items.length}
          onClick={() => {
            void mark(items[0].id, true);
          }}
        >
          Mark current notifications read
        </Button>
      </div>
      <FormError message={error} />
      {query.isPending ? (
        <p role="status">Loading notifications…</p>
      ) : query.isError ? (
        <ErrorState
          message={query.error.message}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : items.length ? (
        items.map((item) => {
          const href = notificationLink(item, !!user?.is_admin);
          return (
            <article className="card space-y-3 p-5" key={item.id}>
              <Badge>{item.read_at ? "Read" : "Unread"}</Badge>
              <h2 className="text-xl">{item.title}</h2>
              <p className="whitespace-pre-wrap break-words">{item.body}</p>
              <p className="text-xs text-muted">
                {new Date(item.created_at).toLocaleString()}
              </p>
              <div className="flex flex-wrap gap-2">
                {href && (
                  <ButtonLink variant="secondary" href={href}>
                    Open details
                  </ButtonLink>
                )}
                {!item.read_at && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      void mark(item.id);
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <p className="help-note">You have no notifications yet.</p>
      )}
      {query.hasNextPage && (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => {
            void query.fetchNextPage();
          }}
        >
          Older notifications
        </Button>
      )}
    </div>
  );
}
