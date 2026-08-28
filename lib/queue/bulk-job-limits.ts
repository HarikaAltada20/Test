/** Max creators per bulk payment job (queue processes one creator per hop). */
export const MAX_BULK_PAYMENT_CREATORS = 500;

/** Max total submission ids referenced across all creators in one payment job. */
export const MAX_BULK_PAYMENT_SUBMISSIONS = 10_000;

/** Max submissions per bulk moderation (verify/reject/pending) job. */
export const MAX_BULK_MODERATION_SUBMISSIONS = 5_000;

/** Max submission IDs stored on one bulk video-download session. */
export const MAX_BULK_VIDEO_DOWNLOAD_SESSION_SUBMISSIONS = 10_000;

/** Max concurrently active bulk payment jobs (queued + running in Redis). */
export const BULK_PAYMENT_MAX_ACTIVE_JOBS_GLOBAL = 8;

/** Max concurrently active bulk moderation jobs (queued + running in Redis). */
export const BULK_MODERATION_MAX_ACTIVE_JOBS_GLOBAL = 8;
