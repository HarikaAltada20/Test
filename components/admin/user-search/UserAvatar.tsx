"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { userInitials } from "./types";

const COLORS = ["#7b4ae0", "#1f8a70", "#c26a00", "#3b6fd8", "#b4377a", "#4A00BE"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function UserAvatar({
  user,
  size = 36,
  className,
}: {
  user: {
    id: string;
    full_name: string | null;
    username: string | null;
    profile_picture_url?: string | null;
  };
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = user.profile_picture_url;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover flex-none", className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ ...style, background: colorFor(user.id) }}
      className={cn(
        "rounded-full flex-none grid place-items-center font-semibold text-white",
        className
      )}
    >
      {userInitials(user)}
    </div>
  );
}
