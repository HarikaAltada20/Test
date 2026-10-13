import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { creatorInitials } from "@/lib/campaign-access";

type Props = {
  username?: string | null;
  fullName?: string | null;
  src?: string | null;
  size?: "sm" | "md";
  className?: string;
};

/** Creator picture with an initials fallback. Decorative: the name is always shown next to it. */
export function CreatorAvatar({ username, fullName, src, size = "md", className }: Props) {
  return (
    <Avatar className={cn(size === "sm" ? "h-7 w-7" : "h-9 w-9", className)} aria-hidden="true">
      {src && (
        <AvatarImage src={src} alt="" referrerPolicy="no-referrer" className="object-cover" />
      )}
      <AvatarFallback
        className={cn(
          "bg-purple-100 font-semibold text-[#4A00BE] dark:bg-[#7F39EC]/25 dark:text-purple-200",
          size === "sm" ? "text-[10px]" : "text-xs",
        )}
      >
        {creatorInitials(fullName, username)}
      </AvatarFallback>
    </Avatar>
  );
}
