-- Add survey tracking fields to survey_redemptions table
-- This enables tracking of button clicks and prevents multiple redemptions

-- Add new columns to track survey button clicks and reward claims
-- First add nullable columns, then set defaults for existing rows, then make NOT NULL
alter table public.survey_redemptions
  add column if not exists survey_button_clicked boolean default false,
  add column if not exists survey_reward_claimed boolean default false,
  add column if not exists survey_button_clicked_at timestamptz,
  add column if not exists survey_reward_claimed_at timestamptz;

-- Update existing rows to have default values
update public.survey_redemptions
set 
  survey_button_clicked = coalesce(survey_button_clicked, false),
  survey_reward_claimed = coalesce(survey_reward_claimed, false)
where survey_button_clicked is null or survey_reward_claimed is null;

-- Now make columns NOT NULL
alter table public.survey_redemptions
  alter column survey_button_clicked set not null,
  alter column survey_reward_claimed set not null,
  alter column survey_button_clicked set default false,
  alter column survey_reward_claimed set default false;

-- Add comments for documentation
comment on column public.survey_redemptions.survey_button_clicked is 'Whether user accessed the survey form from the in-app button';
comment on column public.survey_redemptions.survey_reward_claimed is 'Whether they already claimed the survey reward';
comment on column public.survey_redemptions.survey_button_clicked_at is 'Timestamp when user clicked the survey button (for audit)';
comment on column public.survey_redemptions.survey_reward_claimed_at is 'Timestamp when reward was claimed (for payout tracking)';

-- Add index for faster queries on button click status
create index if not exists idx_survey_redemptions_button_clicked 
  on public.survey_redemptions(survey_button_clicked);

create index if not exists idx_survey_redemptions_reward_claimed 
  on public.survey_redemptions(survey_reward_claimed);

-- Add update policy for survey_redemptions (needed to track button clicks)
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'survey_redemptions' 
    and policyname = 'survey_redemptions_update_own'
  ) then
    create policy survey_redemptions_update_own on public.survey_redemptions
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Grant update permission to authenticated users
grant update on public.survey_redemptions to authenticated;

