"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { EmailProjectCardData } from "./EmailProjectCard";

type Props = {
  open: boolean;
  projects: EmailProjectCardData[];
  defaultProjectId?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaignId: string) => void;
};

export function CreateEmailCampaignModal({
  open,
  projects,
  defaultProjectId,
  onOpenChange,
  onCreated,
}: Props) {
  const [campaignName, setCampaignName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCampaignName("");
    setError(null);
    const fallback =
      defaultProjectId ?? projects[0]?.id ?? "";
    setProjectId(fallback);
  }, [open, defaultProjectId, projects]);

  const projectLabel = (p: EmailProjectCardData) => {
    const verified = p.ses_verification_status === "verified";
    return verified ? `${p.name} (Verified)` : p.name;
  };

  const handleContinue = async () => {
    const name = campaignName.trim();
    if (!name || !projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create campaign");
        return;
      }
      onCreated(data.campaign.id);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden bg-white border-gray-200"
        hideCloseButton
      >
        <div className="bg-[#662EBD] px-6 py-5 text-white relative">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 text-white/80 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
          <h2 className="text-lg font-bold pr-8">
            Let&apos;s create a new campaign
          </h2>
          <p className="text-sm text-white/90 mt-1">
            What would you like to name it?
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-gray-800 font-medium">Campaign Name</Label>
            <Input
              placeholder="Enter"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="bg-white border-gray-300 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-800 font-medium">Project Name</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-11 bg-white border-gray-300">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {projectLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            className="w-full h-11 bg-[#662EBD] hover:bg-[#5524a8] text-white font-medium"
            disabled={submitting || !campaignName.trim() || !projectId}
            onClick={handleContinue}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
