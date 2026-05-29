export const SUPPORT_RETENTION_DAYS = parseInt(
  process.env.SUPPORT_RETENTION_DAYS || "90",
  10,
);

export const SUPPORT_MESSAGE_MAX_LENGTH = 4000;

export const SUPPORT_RATE_LIMIT_THREADS_PER_DAY = parseInt(
  process.env.SUPPORT_RATE_LIMIT_THREADS_PER_DAY || "10",
  10,
);

export const SUPPORT_RATE_LIMIT_MESSAGES_PER_THREAD_PER_DAY = parseInt(
  process.env.SUPPORT_RATE_LIMIT_MESSAGES_PER_THREAD_PER_DAY || "50",
  10,
);

export const SUPPORT_DISABLED_MESSAGE =
  "Support chat is unavailable for your account. Please email support@goc.com for assistance.";

export type SupportThreadStatus = "open" | "replied" | "closed";

export type SupportSenderRole = "creator" | "advertiser" | "admin";
