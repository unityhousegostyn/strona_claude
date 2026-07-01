-- Budżet roczny per wspólnota: plan per kategoria kosztów
CREATE TABLE IF NOT EXISTS community_budgets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  category        VARCHAR(100) NOT NULL,
  planned_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, year, category)
);

COMMENT ON TABLE community_budgets IS
  'Planowane kwoty budżetu per kategoria kosztów, rok i wspólnota';

ALTER TABLE community_budgets ENABLE ROW LEVEL SECURITY;
-- Dostęp tylko przez service_role (getSupabaseAdminClient)
