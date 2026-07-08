-- Historia zmian stawek rozliczeniowych
-- Każda zmiana (create/update) zapisuje snapshot stawek

CREATE TABLE IF NOT EXISTS settlement_rate_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id       uuid NOT NULL,  -- powiązanie z settlement_rates (soft reference — nie FK, bo rate może być usunięta)
  community_id  uuid REFERENCES communities(id) ON DELETE CASCADE,
  changed_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  action        text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  effective_from text,
  -- snapshot wartości
  water_price_m3           numeric,
  water_ryczalt_m3         numeric,
  garbage_per_person       numeric,
  renovation_rate_m2       numeric,
  operating_rate_m2        numeric,
  manager_fee_type         text,
  manager_fee_value        numeric,
  water_billing_type       text,
  water_reconciliation_months int
);

-- Indeks do szybkiego pobierania historii dla danego rate
CREATE INDEX IF NOT EXISTS idx_rate_history_rate_id ON settlement_rate_history(rate_id);
CREATE INDEX IF NOT EXISTS idx_rate_history_community_id ON settlement_rate_history(community_id, changed_at DESC);

-- RLS
ALTER TABLE settlement_rate_history ENABLE ROW LEVEL SECURITY;

-- Tylko service role może pisać (przez getSupabaseAdminClient)
-- Admin/super_admin mogą czytać historię swojej wspólnoty
CREATE POLICY "admin read own community rate history"
  ON settlement_rate_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status = 'active'
        AND profiles.role IN ('admin', 'super_admin')
        AND (
          profiles.role = 'super_admin'
          OR profiles.community_id = settlement_rate_history.community_id
        )
    )
  );
