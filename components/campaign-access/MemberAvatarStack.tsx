import { cn } from "@/lib/utils";
import type { AllowlistPreviewMember } from "@/lib/campaign-access";
import { CreatorAvatar } from "./CreatorAvatar";

type Props = {
  members: AllowlistPreviewMember[] | undefined;
  /** Everyone on the list; the rest show as "+N". */
  total: number;
  className?: string;
};

/** First few member photos, overlapped, with "+N" for the rest. */
export function MemberAvatarStack({ members, total, className }: Props) {
  if (!members || members.length === 0) return null;
  const extra = Math.max(0, total - members.length);
  const names = members.map((m) => `@${m.username ?? "creator"}`).join(", ");
  return (
    <span
      className={cn("inline-flex items-center", className)}
      role="img"
      aria-label={extra > 0 ? `${names} and ${extra} more` : names}
    >
      {members.map((m, i) => (
        <CreatorAvatar
          key={m.user_id}
          size="sm"
          username={m.username}
          fullName={m.full_name}
          src={m.profile_picture_url}
          className={cn("ring-2 ring-white dark:ring-[#170337]", i > 0 && "-ml-2")}
        />
      ))}
      {extra > 0 && (
        <span
          aria-hidden="true"
          className="-ml-2 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600 ring-2 ring-white dark:bg-white/10 dark:text-gray-300 dark:ring-[#170337]"
        >
          +{extra > 99 ? "99" : extra}
        </span>
      )}
    </span>
  );
}
