"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { booksApi } from "@/features/books/api";
import { exchangesApi } from "../api";
import { protectedRequest } from "@/features/auth/session";
import { Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
import type { Book } from "@/features/books/types";
export function ProposalForm({ requested }: { requested: Book }) {
  const { user } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const mine = useQuery({
    queryKey: ["books", "mine", offset],
    queryFn: ({ signal }) => booksApi.mine(offset, signal),
  });
  const eligible = useQuery({
    queryKey: ["membership", "eligibility", user!.id],
    queryFn: () => protectedRequest({ url: "/membership/eligibility" }),
    retry: false,
  });
  if (requested.owner_id === user!.id)
    return (
      <ButtonLink href={`/my-books/${requested.id}/edit`}>
        Manage your listing
      </ButtonLink>
    );
  if (requested.is_reserved || requested.is_archived || requested.is_hidden)
    return (
      <p className="help-note">
        This listing is not currently available for a proposal.
      </p>
    );
  if (eligible.isPending || mine.isPending)
    return <p role="status">Checking books and verification…</p>;
  if (eligible.isError || user!.is_participation_restricted)
    return (
      <div className="help-note">
        <p>
          {eligible.error?.message ??
            "Participation is restricted for this account."}
        </p>
        <ButtonLink href="/membership" variant="ghost">
          Review verification
        </ButtonLink>
      </div>
    );
  if (mine.isError)
    return (
      <ErrorState
        message={mine.error.message}
        retry={() => {
          void mine.refetch();
        }}
      />
    );
  const available = mine.data!.filter(
    (book) =>
      book.owner_id === user!.id &&
      book.campus_id === requested.campus_id &&
      !book.is_archived &&
      !book.is_hidden &&
      !book.is_reserved &&
      book.physical_book_id !== requested.physical_book_id,
  );
  return (
    <div className="card mt-6 p-5">
      <h2 className="text-xl">Offer a book from your shelf.</h2>
      <form
        key={offset}
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const offered = String(
            new FormData(event.currentTarget).get("offered"),
          );
          setPending(true);
          setError(undefined);
          try {
            const exchange = await exchangesApi.propose(requested.id, offered);
            await client.invalidateQueries({ queryKey: ["exchanges"] });
            router.push(`/exchanges/${exchange.id}`);
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Proposal failed.",
            );
            await client.invalidateQueries({ queryKey: ["books"] });
          } finally {
            setPending(false);
          }
        }}
      >
        <label htmlFor="offered-book">Your offered book</label>
        <Select
          id="offered-book"
          name="offered"
          required
          disabled={pending || !available.length}
          defaultValue=""
        >
          <option value="">Choose an available book</option>
          {available.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title} — {book.author}
            </option>
          ))}
        </Select>
        {!available.length && (
          <p className="text-sm text-muted">
            No eligible books on this page. Check another page or list a book.
          </p>
        )}
        <FormError message={error} />
        <Button type="submit" disabled={pending || !available.length}>
          {pending ? "Sending…" : "Send exchange proposal"}
        </Button>
      </form>
      <Pagination
        offset={offset}
        pageSize={12}
        hasMore={mine.data!.length === 12}
        pending={pending}
        onChange={setOffset}
      />
      <ButtonLink href="/my-books/new" variant="ghost">
        List another book
      </ButtonLink>
    </div>
  );
}
