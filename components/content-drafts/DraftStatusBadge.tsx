import { CircleCheck, CircleX, Clock, RotateCcw, Send, Undo2, type LucideIcon } from "lucide-react";
import { CampaignBadge } from "@/components/campaign-access/AccessBadge";
import {
  DRAFT_STATUS_LABELS,
  DRAFT_STATUS_TONES,
  type DraftDisplayStatus,
} from "@/lib/content-drafts";

const ICONS: Record<DraftDisplayStatus, LucideIcon> = {
  pending_review: Clock,
  revision_requested: RotateCcw,
  approved: CircleCheck,
  posted: Send,
  rejected: CircleX,
  withdrawn: Undo2,
};

export function DraftStatusBadge({
  status,
  size,
  className,
}: {
  status: DraftDisplayStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <CampaignBadge tone={DRAFT_STATUS_TONES[status]} icon={ICONS[status]} size={size} className={className}>
      {DRAFT_STATUS_LABELS[status]}
    </CampaignBadge>
  );
}
