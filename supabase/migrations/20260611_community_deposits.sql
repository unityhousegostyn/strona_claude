-- Lokaty bankowe i konta oszczędnościowe wspólnot
CREATE TABLE IF NOT EXISTS community_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'lokata' CHECK (type IN ('lokata', 'konto_oszczednosciowe')),
  bank_name       TEXT,
  description     TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  interest_rate   NUMERIC(5,2),         -- % w skali roku
  start_date      DATE NOT NULL,
  end_date        DATE,                  -- NULL = konto bez terminu
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE community_deposits ENABLE ROW LEVEL SECURITY;

-- super_admin i admin mogą zarządzać lokatami swojej wspólnoty
CREATE POLICY "deposits_select" ON community_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR (p.role = 'admin' AND p.community_id = community_deposits.community_id))
    )
  );

CREATE POLICY "deposits_insert" ON community_deposits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR (p.role = 'admin' AND p.community_id = community_deposits.community_id))
    )
  );

CREATE POLICY "deposits_update" ON community_deposits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR (p.role = 'admin' AND p.community_id = community_deposits.community_id))
    )
  );

CREATE POLICY "deposits_delete" ON community_deposits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  );
