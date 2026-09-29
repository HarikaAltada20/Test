export type CampaignStartReadiness = {
  hasLeads: boolean;
  hasSequence: boolean;
  hasOptions: boolean;
  canStart: boolean;
  disabledReason: string | null;
};

export function getCampaignStartReadiness(input: {
  recipientCount?: number;
  emailSubject?: string | null;
  messageTemplate?: string | null;
  fromEmail?: string | null;
}): CampaignStartReadiness {
  const hasLeads = (input.recipientCount ?? 0) > 0;
  const hasSequence =
    !!input.emailSubject?.trim() && !!input.messageTemplate?.trim();
  const hasOptions = !!input.fromEmail?.trim();
  const canStart = hasLeads && hasSequence && hasOptions;

  let disabledReason: string | null = null;
  if (!hasSequence && !hasOptions) {
    disabledReason =
      "Configure Sequence (subject and body) and Options (sender) before starting";
  } else if (!hasSequence) {
    disabledReason =
      "Configure the Sequence tab (subject and body) before starting";
  } else if (!hasOptions) {
    disabledReason = "Save Options (sender email) before starting";
  } else if (!hasLeads) {
    disabledReason = "Add leads on the Lead tab before starting";
  }

  return { hasLeads, hasSequence, hasOptions, canStart, disabledReason };
}
