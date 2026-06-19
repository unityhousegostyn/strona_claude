-- Znacznik funduszu remontowego na wydatkach
-- Uruchom w Supabase SQL Editor

ALTER TABLE community_expenses
  ADD COLUMN IF NOT EXISTS is_renovation_fund boolean NOT NULL DEFAULT false;

-- Wydatki już skategoryzowane jako fundusz_remontowy → oznacz automatycznie
UPDATE community_expenses
SET is_renovation_fund = true
WHERE category = 'fundusz_remontowy';
