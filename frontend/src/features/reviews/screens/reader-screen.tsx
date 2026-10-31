"use client";
import { ReaderAvatar } from "@/components/ui/reader-avatar";
import { ReaderBooks } from "@/features/profile/components/reader-books";
import { ButtonLink } from "@/components/ui/button";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { reviewsApi } from "../api";
import { SafetyActions } from "@/features/blocking/components/safety-actions";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
export function ReaderScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ["reader", id],
    queryFn: () => reviewsApi.profile(id),
  });
  const reputation = useQuery({
    queryKey: ["reputation", id],
    queryFn: () => reviewsApi.reputation(id),
  });
  const reviews = useInfiniteQuery({
    queryKey: ["reviews", "reader", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => reviewsApi.list(id, pageParam),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
  });
  const rep = reputation.data;
  return (
    <div className="max-w-3xl space-y-5">
      {profile.data && (
        <ReaderAvatar
          url={profile.data.avatar_url}
          name={profile.data.display_name ?? "Reader"}
        />
      )}
      <h1 className="text-4xl">
        {profile.data?.display_name ?? "Reader profile"}
      </h1>
      {profile.isError && (
        <ErrorState
          message={profile.error.message}
          retry={() => {
            void profile.refetch();
          }}
        />
      )}
      {profile.data?.bio && (
        <p className="whitespace-pre-wrap break-words">{profile.data.bio}</p>
      )}
      {profile.data?.campus && (
        <p className="text-muted">{profile.data.campus.name}</p>
      )}
      {!!profile.data?.reading_interests.length && (
        <p className="text-sm text-muted">
          Reading interests: {profile.data.reading_interests.join(", ")}
        </p>
      )}
      {profile.data?.membership_verified && (
        <p className="badge badge-success">Campus verified</p>
      )}
      {reputation.isPending ? (
        <p role="status">Loading reputation…</p>
      ) : reputation.isError ? (
        <ErrorState
          message={reputation.error.message}
          retry={() => {
            void reputation.refetch();
          }}
        />
      ) : (
        rep && (
          <section className="card space-y-3 p-5">
            <h2 className="text-2xl">Exchange reputation</h2>
            <p>
              {rep.average_rating === null
                ? "No published ratings"
                : `${rep.average_rating.toFixed(1)} out of 5`}{" "}
              · {rep.review_count} reviews
            </p>
            <p>
              {rep.completed_exchanges} completed exchanges ·{" "}
              {rep.distinct_exchange_partners} exchange partners
            </p>
            <p className="text-sm text-muted">
              {rep.trust_status === "AVAILABLE" && rep.trust_score !== null
                ? `Trust score: ${rep.trust_score}`
                : `Trust score needs at least ${rep.minimum_distinct_reviewers} distinct reviewers.`}
            </p>
          </section>
        )
      )}
      {user?.id !== id && <SafetyActions userId={id} />}
      {profile.isSuccess &&
        (user?.id === id ? (
          <ButtonLink variant="secondary" href="/my-books">
            Manage your shelf
          </ButtonLink>
        ) : (
          <ReaderBooks id={id} />
        ))}
      <section className="space-y-3">
        <h2 className="text-2xl">Published reviews</h2>
        {reviews.isPending ? (
          <p role="status">Loading reviews…</p>
        ) : reviews.isError ? (
          <ErrorState
            message={reviews.error.message}
            retry={() => {
              void reviews.refetch();
            }}
          />
        ) : reviews.data.pages.flatMap((p) => p.items).length === 0 ? (
          <p className="text-muted">No published reviews yet.</p>
        ) : (
          reviews.data.pages
            .flatMap((p) => p.items)
            .map((item) => (
              <article className="card p-5" key={item.id}>
                <h3>
                  {item.reviewer_name ?? "Reader"} · {item.rating}/5
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {item.comment}
                </p>
              </article>
            ))
        )}
        {reviews.hasNextPage && (
          <Button
            variant="secondary"
            disabled={reviews.isFetching}
            onClick={() => {
              void reviews.fetchNextPage();
            }}
          >
            Earlier reviews
          </Button>
        )}
      </section>
    </div>
  );
}
