import { cn } from "@/lib/utils";
import { userTypeLabel } from "./types";

export function UserTypeBadge({
  userType,
  isDark,
}: {
  userType: string;
  isDark: boolean;
}) {
  const tone =
    userType === "advertiser"
      ? isDark
        ? "bg-amber-900/40 text-amber-300"
        : "bg-amber-50 text-amber-700"
      : userType === "admin"
        ? isDark
          ? "bg-sky-900/40 text-sky-300"
          : "bg-sky-50 text-sky-700"
        : isDark
          ? "bg-[#2a1760] text-[#d6c6ff]"
          : "bg-[#efe8fb] text-[#4A00BE]";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone
      )}
    >
      {userTypeLabel(userType)}
    </span>
  );
}
