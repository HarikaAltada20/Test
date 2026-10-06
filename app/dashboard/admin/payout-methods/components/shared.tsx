"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { CreditCard, Landmark, Mail, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const METHOD_LABELS: Record<string, string> = {
  skydo: "Skydo",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  crypto: "Crypto",
  phantom: "Phantom",
};

export const METHOD_ORDER = ["upi", "bank_transfer", "crypto", "skydo", "phantom"];

export function MethodIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-4 w-4 shrink-0", className);
  if (type === "skydo") return <Mail className={cls} />;
  if (type === "upi") return <Sparkles className={cls} />;
  if (type === "bank_transfer") return <Landmark className={cls} />;
  if (type === "crypto" || type === "phantom") return <Wallet className={cls} />;
  return <CreditCard className={cls} />;
}

export function useIsDark(): boolean {
  const read = () => {
    if (typeof document === "undefined") return false;
    const attr = document.querySelector("[data-mode]")?.getAttribute("data-mode");
    if (attr) return attr === "dark";
    return document.documentElement.getAttribute("data-theme") === "dark";
  };
  const [isDark, setIsDark] = useState<boolean>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(read()));
    const target = document.querySelector("[data-mode]");
    if (target) observer.observe(target, { attributes: true, attributeFilter: ["data-mode"] });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

/** Re-renders every `intervalMs` so relative times stay fresh. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function durationSince(value: string | null | undefined): string {
  if (!value) return "";
  return formatDistanceToNowStrict(new Date(value));
}

export function exactTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function WithTooltip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RelativeTime({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <WithTooltip content={exactTime(value)}>
      <span className={cn("cursor-default", className)}>{relativeTime(value)}</span>
    </WithTooltip>
  );
}

export function palette(isDark: boolean) {
  return {
    page: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-muted-foreground",
    surface: isDark ? "bg-[#0B0629] border-gray-800" : "bg-white border-gray-200",
    surfaceAlt: isDark ? "bg-[#120A35]" : "bg-gray-50",
    input: isDark ? "bg-[#06021D] border-gray-700 text-white placeholder:text-gray-500" : "bg-white",
    hover: isDark ? "hover:bg-white/5" : "hover:bg-gray-50",
    selected: isDark ? "bg-[#7F39EC]/15" : "bg-[#F5EEFF]",
    accent: "#7F39EC",
    accentRing: "ring-[#7F39EC] border-[#7F39EC]",
    button: isDark
      ? "border-gray-700 bg-transparent text-white hover:bg-white/10"
      : "",
  };
}
