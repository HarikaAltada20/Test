/** Max creators per bulk payment job (queue processes one creator per hop). */
export const MAX_BULK_PAYMENT_CREATORS = 500;

/** Max total submission ids referenced across all creators in one payment job. */
export const MAX_BULK_PAYMENT_SUBMISSIONS = 10_000;

/** Max submissions per bulk moderation (verify/reject/pending) job. */
export const MAX_BULK_MODERATION_SUBMISSIONS = 5_000;
