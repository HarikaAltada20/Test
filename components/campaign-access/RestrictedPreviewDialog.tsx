"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import type { ApplicationQuestion, ContestPreview } from "@/lib/campaign-access";
import { RestrictedCampaignPreview } from "./RestrictedCampaignPreview";

type Props = {
  title: string;
  thumbnailUrl: string | null;
  platform: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string;
  applicationsOpen: boolean;
  questions: ApplicationQuestion[];
  accent?: "purple" | "ink";
};

/** "Preview as creator": shows the Restricted preview and apply form built from the unsaved form. */
export function RestrictedPreviewDialog(props: Props) {
  const isDark = useDashboardDark();
  const ink = props.accent === "ink";
  const [open, setOpen] = useState(false);

  const preview = useMemo<ContestPreview>(
    () => ({
      id: "preview",
      title: props.title.trim() || null,
      brand_name: null,
      thumbnail_url: props.thumbnailUrl,
      platform: props.platform,
      contest_type: null,
      contest_format: null,
      status: null,
      start_date: props.startDate || null,
      end_date: props.endDate || null,
      contest_based_details: null,
      preview_description: props.description.trim() || null,
      applications_open: props.applicationsOpen,
      has_ended: false,
      has_access: false,
      questions: props.questions
        .filter((q) => q.prompt.trim())
        .map((q, i) => ({ ...q, id: q.id ?? `preview-${i}` })),
      my_application: null,
    }),
    [props],
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          ink
            ? "border border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f3f3f5] dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
            : "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10",
        )}
        onClick={() => setOpen(true)}
      >
        <Eye className="mr-1.5 h-4 w-4" /> Preview as creator
      </Button>
      <Dialog isdark={isDark} open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn("max-h-[90vh] overflow-y-auto sm:max-w-3xl", isDark && "dark text-white")}
          // Keep focus off the badge tooltip so it doesn't pop open on its own.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>What applicants will see</DialogTitle>
            <DialogDescription>
              Built from your unsaved changes. The prize shows once the campaign is saved.
            </DialogDescription>
          </DialogHeader>
          <RestrictedCampaignPreview
            preview={preview}
            onChanged={() => {}}
            previewMode
            accent={props.accent}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
