"use client";
import Image from "next/image";
import { useState } from "react";
export function ReaderAvatar({
  url,
  name,
  size = 64,
}: {
  url: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string>();
  const source = /^\/assets\/avatars\/reader_\d{2}\.svg$/.test(url)
    ? url
    : undefined;
  return source && failed !== source ? (
    <Image
      src={source}
      alt={name}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(source)}
      className="reader-avatar"
    />
  ) : (
    <span className="reader-avatar reader-avatar-fallback" aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
