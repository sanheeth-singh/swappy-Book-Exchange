"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { protectedRequest } from "@/features/auth/session";
import { BookCover } from "@/components/cards/book-cover";
import { useAuth } from "@/features/auth/auth-provider";
import { useOverlayStore } from "@/stores/overlay-store";
import { booksApi } from "../api";
import { canEditListing, listingState } from "../policies";
import type { BookInput } from "../types";
import { BookForm } from "../components/book-form";
import { CampusGate } from "../components/campus-gate";
import { Card } from "@/components/ui/card";
import { PhotoRemoveButton } from "@/components/ui/photo-remove-button";
import { PhotoUpload } from "../components/photo-upload";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/feedback/form-error";
import { ErrorState } from "@/components/feedback/error-state";
export function BookEditorScreen({ id }: { id?: string }) {
  return (
    <CampusGate>
      <Editor id={id} />
    </CampusGate>
  );
}
function Editor({ id }: { id?: string }) {
  const auth = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const copy = params.get("copy");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // My Books includes archived/reserved/hidden listings; detail endpoint intentionally does not.
  const query = useQuery({
    queryKey: ["books", "manage", id],
    enabled: !!id,
    queryFn: async ({ signal }) => {
      for (let offset = 0; ; offset += 12) {
        const page = await booksApi.mine(offset, signal);
        const book = page.find((item) => item.id === id);
        if (book) return book;
        if (page.length < 12)
          throw new Error("This listing is not in your shelf.");
      }
    },
  });
  const collection = useQuery({
    queryKey: ["books", "relist", copy],
    enabled: !id && !!copy,
    queryFn: async ({ signal }) => {
      for (let offset = 0; ; offset += 12) {
        const page = await booksApi.collection(offset, signal);
        const book = page.find((item) => item.id === copy);
        if (book) return book;
        if (page.length < 12)
          throw new Error("This copy is not in your collection.");
      }
    },
  });
  const eligibility = useQuery({
    queryKey: ["membership", "eligibility", auth.user!.id],
    queryFn: () => protectedRequest({ url: "/membership/eligibility" }),
    retry: false,
  });
  const canPublish =
    eligibility.isSuccess && !auth.user!.is_participation_restricted;
  async function invalidate() {
    await client.invalidateQueries({ queryKey: ["books"] });
    await client.invalidateQueries({ queryKey: ["public-preview"] });
    await client.invalidateQueries({ queryKey: ["exchanges"] });
  }
  async function save(data: BookInput, preview: boolean) {
    setPending(true);
    try {
      const book = id
        ? await booksApi.update(id, data)
        : await booksApi.create({
            ...data,
            allow_public_preview: preview,
            ...(copy ? { physical_book_id: copy } : {}),
          });
      await invalidate();
      if (!id) router.replace(`/my-books/${book.id}/edit`);
    } finally {
      setPending(false);
    }
  }
  async function action(work: () => Promise<unknown>) {
    setPending(true);
    setError(undefined);
    try {
      await work();
      await invalidate();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }
  if ((id && query.isPending) || (!id && copy && collection.isPending))
    return <p role="status">Loading your book…</p>;
  if (query.error || collection.error)
    return (
      <ErrorState
        message={(query.error ?? collection.error)!.message}
        retry={() => {
          void query.refetch();
          if (copy) void collection.refetch();
        }}
      />
    );
  const book = query.data;
  const editable = book ? canEditListing(book, auth.user!.id) : true;
  return (
    <div className="max-w-3xl space-y-6">
      <div className="section-heading">
        <h1 className="text-4xl">
          {id ? "Manage your listing." : "Give a book its next chapter."}
        </h1>
        <ButtonLink href="/my-books" variant="ghost">
          Back to My Books
        </ButtonLink>
      </div>
      <p className="help-note">
        Creating, editing and adding photos require active campus verification.
        Reserved books cannot be changed. Editing or adding a photo withdraws
        competing pending proposals.
      </p>
      {!id || editable ? (
        <Card className="p-6">
          {eligibility.isPending ? (
            <p role="status">Checking publication eligibility…</p>
          ) : !canPublish ? (
            <div>
              <p className="text-muted">
                {eligibility.error?.message ??
                  "This account cannot currently publish listings."}
              </p>
              <ButtonLink
                href="/membership"
                className="mt-4"
                variant="secondary"
              >
                Review campus verification
              </ButtonLink>
            </div>
          ) : (
            <BookForm
              key={book?.id ?? copy ?? "new"}
              initial={book ?? collection.data ?? undefined}
              create={!id}
              pending={pending}
              onSave={save}
            />
          )}
        </Card>
      ) : (
        <Card className="p-6">
          <Badge>{listingState(book!)}</Badge>
          <h2 className="mt-3 text-2xl">{book!.title}</h2>
          <p className="mt-3 text-muted">
            This listing cannot be edited in its current state.
          </p>
        </Card>
      )}
      {book && (
        <Card className="space-y-4 p-6">
          <h2 className="text-2xl">Listing controls</h2>
          <p className="text-sm text-muted">
            {book.photos.length} of 3 photos uploaded.
          </p>
          <div className="flex flex-wrap gap-3">
            {book.photos.map((photo) => (
              <div key={photo.id} className="photo-tile">
                <BookCover
                  title={book.title}
                  author={book.author}
                  coverUrl={photo.url}
                  compact
                  className="w-20"
                />
                {editable && canPublish && (
                  <PhotoRemoveButton
                    label="Delete book photo"
                    disabled={pending}
                    onClick={() =>
                      useOverlayStore.getState().openConfirmation({
                        title: "Delete this photo?",
                        description:
                          "It will be removed from this listing. Other pending proposals involving this listing will be withdrawn.",
                        confirmLabel: "Delete photo",
                        destructive: true,
                        onConfirm: async () => {
                          try {
                            await booksApi.removePhoto(book.id, photo.id);
                          } finally {
                            await invalidate();
                          }
                        },
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {editable && canPublish && book.photos.length < 3 && (
            <PhotoUpload
              remainingSlots={3 - book.photos.length}
              disabled={pending}
              onUpload={async (file) => {
                setPending(true);
                try {
                  await booksApi.photo(book.id, file);
                } finally {
                  await invalidate();
                  setPending(false);
                }
              }}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={
                pending ||
                (!book.allow_public_preview && (!editable || !canPublish))
              }
              variant="secondary"
              onClick={() => {
                void action(() =>
                  booksApi.preview(book.id, !book.allow_public_preview),
                );
              }}
            >
              {book.allow_public_preview
                ? "Remove from public preview"
                : "Allow public preview"}
            </Button>
            {!book.is_archived && (
              <Button
                variant="danger"
                disabled={pending || book.is_reserved}
                onClick={() =>
                  useOverlayStore.getState().openConfirmation({
                    title: "Archive this listing?",
                    description:
                      "It leaves the active shelf and pending proposals involving it are rejected. Your physical book stays in your collection.",
                    confirmLabel: "Archive listing",
                    destructive: true,
                    onConfirm: async () => {
                      await booksApi.archive(book.id);
                      await invalidate();
                    },
                  })
                }
              >
                Archive listing
              </Button>
            )}
          </div>
          <FormError message={error} />
        </Card>
      )}
      <ButtonLink href="/membership" variant="ghost">
        Check campus verification
      </ButtonLink>
    </div>
  );
}
