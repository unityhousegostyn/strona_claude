-- Tabela kosztów wspólnot
CREATE TABLE IF NOT EXISTS community_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  category        varchar(50) NOT NULL DEFAULT 'inne',
  description     text NOT NULL,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  expense_date    date NOT NULL,
  year            int NOT NULL GENERATED ALWAYS AS (EXTRACT(year  FROM expense_date)::int) STORED,
  month           int NOT NULL GENERATED ALWAYS AS (EXTRACT(month FROM expense_date)::int) STORED,
  invoice_number  varchar(100),
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_community_year ON community_expenses(community_id, year);
CREATE INDEX IF NOT EXISTS idx_expenses_year_month     ON community_expenses(year, month);

-- RLS
ALTER TABLE community_expenses ENABLE ROW LEVEL SECURITY;

-- Odczyt: admin widzi swoją wspólnotę, super_admin widzi wszystko
CREATE POLICY "expenses_select" ON community_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role = 'super_admin'
          OR (profiles.role IN ('admin','user') AND profiles.community_id = community_expenses.community_id)
        )
    )
  );

-- Zapis (INSERT/UPDATE/DELETE): tylko admin i super_admin
CREATE POLICY "expenses_insert" ON community_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','super_admin')
    )
  );

CREATE POLICY "expenses_update" ON community_expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','super_admin')
    )
  );

CREATE POLICY "expenses_delete" ON community_expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','super_admin')
    )
  );
