CREATE TABLE IF NOT EXISTS community_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  category varchar(50) NOT NULL DEFAULT 'inne',
  description text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  income_date date NOT NULL,
  year int NOT NULL GENERATED ALWAYS AS (EXTRACT(year FROM income_date)::int) STORED,
  month int NOT NULL GENERATED ALWAYS AS (EXTRACT(month FROM income_date)::int) STORED,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_income_community ON community_income(community_id);
CREATE INDEX IF NOT EXISTS idx_community_income_year ON community_income(community_id, year);

ALTER TABLE community_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_select" ON community_income
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin','admin') OR profiles.community_id = community_income.community_id)
    )
  );

CREATE POLICY "income_insert" ON community_income
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "income_update" ON community_income
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','admin')
    )
  );

CREATE POLICY "income_delete" ON community_income
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin','admin')
    )
  );
