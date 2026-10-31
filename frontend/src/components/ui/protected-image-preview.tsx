"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { FormError } from "@/components/feedback/form-error";
export function ProtectedImagePreview({
  load,
  label = "Preview ID",
}: {
  load: () => Promise<Blob>;
  label?: string;
}) {
  const [url, setUrl] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="my-4">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          if (url) {
            setUrl(undefined);
            return;
          }
          const epoch = ++generation.current;
          setPending(true);
          setError(undefined);
          try {
            const blob = await load();
            if (epoch !== generation.current) return;
            if (!["image/jpeg", "image/png"].includes(blob.type))
              throw new Error(
                "The document is not an available JPEG or PNG image.",
              );
            setUrl(URL.createObjectURL(blob));
          } catch (failure) {
            if (epoch === generation.current)
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Preview unavailable.",
              );
          } finally {
            if (epoch === generation.current) setPending(false);
          }
        }}
      >
        {pending ? "Loading preview…" : url ? "Close preview" : label}
      </Button>
      <FormError message={error} />
      {url && (
        <div className="document-preview mt-4">
          <Image
            src={url}
            alt="Enrollment proof for administrator review"
            width={1200}
            height={900}
            unoptimized
            className="h-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
