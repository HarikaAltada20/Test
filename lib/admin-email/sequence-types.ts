export type SequenceVariant = {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  variant_letter: string;
};

export type SequenceStep = {
  id: string;
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  variants: SequenceVariant[];
  isExpanded?: boolean;
};

export type EmailSequence = {
  id: string;
  campaignId: string;
  projectId: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
};

export type StoredVariant = {
  id: string;
  variant_name: string;
  subject: string;
  body: string;
  is_active: boolean;
  variant_letter: string;
};

export type StoredStep = {
  id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  variants: StoredVariant[];
};

export type StoredSequence = {
  id: string;
  name: string;
  description?: string;
  steps: StoredStep[];
};
