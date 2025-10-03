-- Migration: Add new contest features
-- Date: 2025-10-01
-- Description: Adds multiple submissions, flat fee bonus, content type, bonus section, and earnings cap features

-- Add new columns to contests table
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS multiple_submissions_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_submissions_per_creator INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS content_type TEXT CHECK (content_type IN ('ugc', 'clipping', 'other')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bonus_details JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_earnings_per_creator INTEGER DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.contests.multiple_submissions_enabled IS 'Whether creators can submit multiple entries to this contest';
COMMENT ON COLUMN public.contests.max_submissions_per_creator IS 'Maximum number of submissions allowed per creator (2-100). Defaults to 1 for single submission contests.';
COMMENT ON COLUMN public.contests.content_type IS 'Type of content required: ugc (User Generated Content), clipping (Short clips/repurposed content), or other (Check Rules)';
COMMENT ON COLUMN public.contests.bonus_details IS 'Additional bonus opportunities in JSONB format with rich text content: {
  "description_html": "<ul><li>Top 3 creators get $100 each</li></ul>",
  "description_json": {...}
}';
COMMENT ON COLUMN public.contests.max_earnings_per_creator IS 'Maximum total earnings cap per creator for THIS CONTEST ONLY (stored in cents). This is per-campaign, not platform-wide. Creator can still submit after reaching cap but won''t earn more from this specific contest. Does not affect earnings from other contests.';

-- Create index for content_type filtering
CREATE INDEX IF NOT EXISTS idx_contests_content_type ON public.contests(content_type) WHERE content_type IS NOT NULL;

-- Create index for multiple submissions enabled contests
CREATE INDEX IF NOT EXISTS idx_contests_multiple_submissions ON public.contests(multiple_submissions_enabled) WHERE multiple_submissions_enabled = true;

-- Update contest_based_details comment to include flat_fee_bonus
COMMENT ON COLUMN public.contests.contest_based_details IS 'Contains contest-type-specific details. Money values (total_prize, total_budget, flat_fee_bonus) are stored in cents as integers.

For Leaderboard contests:
{
  "leaderboard_contest": {
    "prizes": [{"position": 1, "amount": 10000}, ...],
    "total_prize": 50000,
    "winner_count": 3,
    "flat_fee_bonus": 1000  // OPTIONAL - flat fee per verified submission (in cents)
  }
}

For CPM contests:
{
  "cpm_contest": {
    "cpm_rate_usd": 5.00,
    "min_views": 1000,              // OPTIONAL
    "max_views": 100000,            // OPTIONAL
    "total_budget": 100000,
    "budget_spent": 0,
    "terms_conditions": "...",
    "flat_fee_bonus": 1000    // OPTIONAL - flat fee per verified submission (in cents)
  }
}

Note: min_views, max_views, and flat_fee_bonus are all optional and apply to ALL submissions when multiple submissions are enabled.';


