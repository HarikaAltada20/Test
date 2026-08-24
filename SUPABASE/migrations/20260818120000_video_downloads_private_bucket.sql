-- Private bucket for bulk Instagram/YouTube ZIP archives.
-- API uses the service role to upload and to issue short-lived signed URLs.
-- No anon/authenticated policies: listing and public URLs must not work.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-downloads',
  'video-downloads',
  false,
  NULL,
  ARRAY['application/zip', 'application/x-zip-compressed']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = NULL,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
