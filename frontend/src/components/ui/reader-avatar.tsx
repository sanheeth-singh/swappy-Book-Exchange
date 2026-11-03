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
    <div className="relative rounded-full bg-[#f7efe5] shadow-[8px_8px_16px_rgba(234,97,19,0.06),-8px_-8px_16px_rgba(255,255,255,0.8)] border-[3px] border-white overflow-hidden flex items-center justify-center">
      <Image
        src={source}
        alt={name}
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(source)}
        className="object-cover"
      />
    </div>
  ) : (
    <span 
      className="flex items-center justify-center rounded-full bg-[#ffe3b3] shadow-[inset_4px_4px_8px_rgba(255,255,255,0.9),inset_-4px_-4px_8px_rgba(234,97,19,0.1)] border-[3px] border-white text-[#a83f08] font-bold" 
      aria-label={name}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}