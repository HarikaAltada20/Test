-- Singleton store for live Instagram Netscape cookies used by admin downloads.
-- Service role only (no RLS policies for anon/authenticated).
CREATE TABLE IF NOT EXISTS public.instagram_download_cookies (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cookies_netscape text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  note text NULL
);

ALTER TABLE public.instagram_download_cookies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.instagram_download_cookies IS
  'Live Instagram session cookies for yt-dlp downloads. Updated when Instagram rotates session tokens.';
