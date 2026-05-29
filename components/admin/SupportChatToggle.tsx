"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  enabled: boolean;
  isDark?: boolean;
  className?: string;
  onUpdated?: (enabled: boolean) => void;
};

export function SupportChatToggle({
  userId,
  enabled: initialEnabled,
  isDark = false,
  className,
  onUpdated,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = async (checked: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/support-chat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEnabled(checked);
      onUpdated?.(checked);
      toast({
        title: checked ? "Support chat enabled" : "Support chat disabled",
      });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Switch
        id={`support-chat-${userId}`}
        checked={enabled}
        disabled={loading}
        onCheckedChange={handleChange}
      />
      <Label
        htmlFor={`support-chat-${userId}`}
        className={cn("text-sm", isDark ? "text-slate-200" : "text-foreground")}
      >
        Support chat {enabled ? "On" : "Off"}
      </Label>
    </div>
  );
}
