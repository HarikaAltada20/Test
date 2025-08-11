export const SUBMISSION_STATUS = {
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
  paid: 'paid',
} as const;

export type SubmissionStatus = typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS];

export const POST_CONTEST_STATUS = {
  pending_review: 'pending_review',
  in_review: 'in_review',
  verification_complete: 'verification_complete',
  payouts_processed: 'payouts_processed',
} as const;

export type PostContestStatus = typeof POST_CONTEST_STATUS[keyof typeof POST_CONTEST_STATUS];

export const CONTEST_MODERATION_STATUS = {
  draft: 'draft',
  pending_approval: 'pending_approval',
  approved: 'approved',
  published: 'published',
} as const;

export type ContestModerationStatus = typeof CONTEST_MODERATION_STATUS[keyof typeof CONTEST_MODERATION_STATUS];


