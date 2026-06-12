export const MAX_PROJECT_DESCRIPTION_LENGTH = 1000;

/** PostgREST embed: disambiguate project → senders (one-to-many) vs default_sender FK */
export const EMAIL_PROJECT_WITH_SENDERS_SELECT = `
  *,
  senders:admin_email_project_senders!admin_email_project_senders_project_id_fkey (
    id, email, is_default, ses_verified
  )
`;
