"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { validateBookInput } from "../validation";
import { booksApi } from "../api";
import type { Book, BookInput, Genre } from "../types";
import { conditionLabels } from "@/lib/config/book-labels";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/feedback/form-error";
export function BookForm({
  initial,
  onSave,
  pending,
  create = false,
}: {
  initial?: Partial<Book>;
  onSave: (data: BookInput, preview: boolean) => Promise<void>;
  pending: boolean;
  create?: boolean;
}) {
  const [error, setError] = useState<string>();
  const genres = useQuery({
    queryKey: ["books", "genres"],
    queryFn: booksApi.genres,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const values = new FormData(event.currentTarget);
    try {
      const data: BookInput = {
        title: String(values.get("title")).trim(),
        author: String(values.get("author")).trim(),
        description: String(values.get("description")).trim(),
        condition: String(values.get("condition")) as BookInput["condition"],
        genre: String(values.get("genre")) as Genre,
        condition_notes: String(values.get("condition_notes") ?? "").trim(),
      };
      const problem = validateBookInput(data);
      if (problem) {
        setError(problem);
        return;
      }
      await onSave(data, values.get("preview") === "on");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The book could not be saved.",
      );
    }
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div>
        <label htmlFor="book-title">Title</label>
        <Input
          id="book-title"
          name="title"
          defaultValue={initial?.title}
          required
          maxLength={200}
        />
      </div>
      <div>
        <label htmlFor="book-author">Author</label>
        <Input
          id="book-author"
          name="author"
          defaultValue={initial?.author}
          required
          maxLength={200}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="book-condition">Condition</label>
          <Select
            id="book-condition"
            name="condition"
            defaultValue={initial?.condition ?? "GOOD"}
          >
            {Object.entries(conditionLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="book-genre">Genre</label>
          <Select
            key={genres.data ? "loaded" : "loading"}
            id="book-genre"
            name="genre"
            defaultValue={initial?.genre ?? ""}
            required
            disabled={genres.isPending || genres.isError}
          >
            <option value="">Choose a genre</option>
            {genres.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          {genres.isError && <FormError message={genres.error.message} />}
        </div>
      </div>
      <div>
        <label htmlFor="book-description">Description</label>
        <Textarea
          id="book-description"
          name="description"
          defaultValue={initial?.description}
          required
          maxLength={2000}
          rows={4}
        />
      </div>
      <div>
        <label htmlFor="book-notes">Condition notes</label>
        <Textarea
          id="book-notes"
          name="condition_notes"
          defaultValue={initial?.condition_notes}
          maxLength={1000}
          rows={2}
        />
      </div>
      {create && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="preview" className="mt-1" />
          Allow this listing in the limited public preview. Book information and
          its cover may be shown to visitors.
        </label>
      )}
      <FormError message={error} />
      <Button type="submit" disabled={pending || !genres.data}>
        {pending ? "Saving…" : create ? "Create listing" : "Save changes"}
      </Button>
    </form>
  );
}
