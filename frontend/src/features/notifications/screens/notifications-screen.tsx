"use client";

import { useState, useMemo } from "react";
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

  // Memoized to prevent heavy array operations on every render
  const items = useMemo(() => {
    const allItems = query.data?.pages.flatMap((p) => p.items) ?? [];
    return [...new Map(allItems.map((n) => [n.id, n])).values()];
  }, [query.data]);

  async function mark(id: string, all = false) {
    setPending(true);
    setError(undefined);
    try {
      if (all) await notificationsApi.readAll(id);
      else await notificationsApi.read(id);
      await client.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not mark notifications read."
      );
    } finally {
      setPending(false);
    }
  }

  // Format date nicely (can be replaced with date-fns or dayjs)
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <header className="space-y-2 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted mt-1">
              Exchange updates, campus verification, and account activity.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Refresh
          </Button>
          <Button
            variant="ghost"
            disabled={pending || !items.length}
            onClick={() => void mark(items[0].id, true)}
          >
            Mark all read
          </Button>
        </div>
      </header>

      <FormError message={error} />

      {/* CONTENT AREA */}
      <div className="space-y-4">
        {query.isPending && (
          <div className="space-y-3">
            {/* Loading Skeletons */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        )}

        {query.isError && (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        )}

        {query.isSuccess && !items.length && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-muted">You're all caught up!</p>
          </div>
        )}

        {query.isSuccess && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, index) => {
              const href = notificationLink(item, !!user?.is_admin);
              const isUnread = !item.read_at;

              return (
                <article
                  key={item.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={`
                    card relative p-5 space-y-3 transition-all duration-300 hover:shadow-md
                    animate-in fade-in slide-in-from-bottom-4 duration-500
                    ${isUnread ? "bg-muted/10 border-l-4 border-primary" : "opacity-75"}
                  `}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        {item.title}
                        {isUnread && <Badge variant="default">New</Badge>}
                      </h2>
                      <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                    <time className="text-xs text-muted whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {href && (
                      <ButtonLink variant="secondary" size="sm" href={href}>
                        View details
                      </ButtonLink>
                    )}
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => void mark(item.id)}
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* PAGINATION */}
      {query.hasNextPage && (
        <div className="pt-4 flex justify-center">
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetching ? "Loading..." : "Load older notifications"}
          </Button>
        </div>
      )}
    </div>
  );
}