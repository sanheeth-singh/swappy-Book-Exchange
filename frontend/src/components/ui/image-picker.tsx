"use client";
import { useEffect, useId, useRef, useState } from "react";
import { BookCover } from "@/components/cards/book-cover";
import { Input } from "./input";
import { Button } from "./button";
import { PhotoRemoveButton } from "./photo-remove-button";
import { FormError } from "@/components/feedback/form-error";
import {
  validateSelection,
  type SelectedImage,
} from "@/lib/utils/image-selection";
export function ImagePicker({
  maxFiles = 1,
  accept,
  validate,
  onUpload,
  disabled = false,
  label = "Choose images",
  uploadLabel = "Upload selected images",
}: {
  maxFiles?: number;
  accept: string;
  validate: (file?: File) => string | undefined;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
  label?: string;
  uploadLabel?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const items = useRef<SelectedImage[]>([]);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string>();
  useEffect(
    () => () => {
      for (const item of items.current) URL.revokeObjectURL(item.url);
    },
    [],
  );
  function replace(next: SelectedImage[]) {
    const retained = new Set(next);
    for (const item of items.current)
      if (!retained.has(item)) URL.revokeObjectURL(item.url);
    items.current = next;
    setSelected(next);
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!items.current.length || pending) return;
        const snapshot = [...items.current];
        setPending(true);
        setError(undefined);
        let completed = 0;
        try {
          for (const item of snapshot) {
            setProgress(`Uploading ${completed + 1} of ${snapshot.length}…`);
            await onUpload(item.file);
            completed++;
            replace(items.current.filter((value) => value !== item));
          }
          if (input.current) input.current.value = "";
          setProgress(
            `${completed} image${completed === 1 ? "" : "s"} uploaded.`,
          );
        } catch (failure) {
          setError(
            `${completed ? `${completed} uploaded. ` : ""}${failure instanceof Error ? failure.message : "Upload failed."} Remaining selections are kept for retry.`,
          );
          setProgress(undefined);
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        ref={input}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={pending || disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          setError(undefined);
          setProgress(undefined);
          const problem = validateSelection(files, maxFiles, validate);
          if (problem) {
            setError(problem);
            event.target.value = "";
            return;
          }
          replace(
            files.map((file) => ({ file, url: URL.createObjectURL(file) })),
          );
        }}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {selected.map((item, index) => (
            <div key={item.url} className="photo-tile">
              <BookCover
                title={`Selected image ${index + 1}`}
                author=""
                coverUrl={item.url}
                compact
                localPreview
                className="w-28"
              />
              <PhotoRemoveButton
                label={`Remove selected image ${index + 1}`}
                disabled={pending}
                onClick={() =>
                  replace(items.current.filter((value) => value !== item))
                }
              />
              <p
                className="mt-2 max-w-28 truncate text-xs text-muted"
                title={item.file.name}
              >
                {item.file.name}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">
        Up to {maxFiles} image{maxFiles === 1 ? "" : "s"} in one selection.
        Previewed locally before upload.
      </p>
      <FormError message={error} />
      {progress && (
        <p role="status" className="text-sm text-muted">
          {progress}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || disabled || !selected.length}
        >
          {pending ? "Uploading…" : uploadLabel}
        </Button>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              replace([]);
              if (input.current) input.current.value = "";
            }}
          >
            Clear selection
          </Button>
        )}
      </div>
    </form>
  );
}
