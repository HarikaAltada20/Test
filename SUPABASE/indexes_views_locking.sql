-- Speeds up locking and cron filters

create index if not exists idx_contests_active on contests(views_locked_at) where views_locked_at is null;

create index if not exists idx_submissions_verified_by_contest on submissions(contest_id) where status = 'verified';

