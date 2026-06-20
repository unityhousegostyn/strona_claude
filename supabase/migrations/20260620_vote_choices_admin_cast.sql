-- =============================================
-- Głos oddany w imieniu mieszkańca przez super_admina (np. na podstawie
-- papierowej karty głosowania) — ślad audytowy w vote_choices.
-- Uruchom w Supabase SQL Editor
-- =============================================

ALTER TABLE vote_choices
  ADD COLUMN IF NOT EXISTS cast_by_admin boolean NOT NULL DEFAULT false;

ALTER TABLE vote_choices
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
