-- Zamknięcia roku finansowego wspólnoty
-- Zablokowanie edycji rozliczeń za zamknięty rok

CREATE TABLE IF NOT EXISTS year_closures (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  closed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by     UUID NOT NULL REFERENCES auth.users(id),
  -- Snapshot finansowy w momencie zamknięcia
  total_apartments  INTEGER NOT NULL DEFAULT 0,
  total_paid        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_due         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_balance     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- paid - due (nadpłata +, niedopłata -)
  notes             TEXT,
  UNIQUE(community_id, year)
);

ALTER TABLE year_closures ENABLE ROW LEVEL SECURITY;

-- Tylko admini przez admin client (server actions)
CREATE POLICY "year_closures_admin_all" ON year_closures
  USING (false) WITH CHECK (false);
