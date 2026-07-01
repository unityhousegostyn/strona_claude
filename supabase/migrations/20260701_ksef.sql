-- ── KSeF: integracja z Krajowym Systemem e-Faktur ────────────────────────────

-- NIP na communities (do dopasowania faktur z KSeF)
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS nip VARCHAR(10);

-- ── Konfiguracja KSeF (jeden wiersz, zarządca) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ksef_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nip           VARCHAR(10)  NOT NULL DEFAULT '',
  ksef_token    TEXT         NOT NULL DEFAULT '',   -- token z portalu KSeF
  environment   TEXT         NOT NULL DEFAULT 'prod'
                  CHECK (environment IN ('test', 'prod')),
  sync_from_date DATE,                              -- skąd zaczynać sync
  last_sync_at  TIMESTAMPTZ,
  last_sync_status TEXT,                            -- 'success' | 'error'
  last_sync_count  INT     DEFAULT 0,
  enabled       BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Tylko jeden wiersz konfiguracji
CREATE UNIQUE INDEX IF NOT EXISTS ksef_settings_singleton
  ON ksef_settings ((true));

-- ── Historia synchronizacji ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ksef_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'running',  -- running | success | error
  invoices_fetched  INT  DEFAULT 0,
  invoices_imported INT  DEFAULT 0,
  invoices_skipped  INT  DEFAULT 0,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Kolejka faktur z KSeF do przejrzenia/przypisania ────────────────────────
CREATE TABLE IF NOT EXISTS ksef_invoice_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ksef_number     TEXT UNIQUE,           -- numer KSeF (unikalny)
  invoice_date    DATE,
  issue_date      DATE,
  seller_name     TEXT,
  seller_nip      VARCHAR(10),
  buyer_nip       VARCHAR(10),
  net_amount      NUMERIC(15,2),
  vat_amount      NUMERIC(15,2),
  gross_amount    NUMERIC(15,2),
  description     TEXT,
  suggested_category TEXT,              -- propozycja kategorii z opisu faktury
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | imported | skipped
  community_id    UUID REFERENCES communities(id),  -- przypisana wspólnota
  expense_id      UUID REFERENCES community_expenses(id),  -- wynikowy koszt
  sync_log_id     UUID REFERENCES ksef_sync_log(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE ksef_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_sync_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_invoice_queue  ENABLE ROW LEVEL SECURITY;

-- ksef_settings: tylko super_admin
CREATE POLICY "ksef_settings_super_admin" ON ksef_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- sync_log: odczyt admin+super_admin
CREATE POLICY "ksef_sync_log_read" ON ksef_sync_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );
CREATE POLICY "ksef_sync_log_write" ON ksef_sync_log
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- kolejka: super_admin może wszystko; admin widzi faktury swojej wspólnoty
CREATE POLICY "ksef_queue_super_admin" ON ksef_invoice_queue
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "ksef_queue_admin_read" ON ksef_invoice_queue
  FOR SELECT TO authenticated
  USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND community_id = ksef_invoice_queue.community_id
    )
  );

COMMENT ON TABLE ksef_settings IS 'Globalna konfiguracja integracji KSeF (jeden wiersz)';
COMMENT ON TABLE ksef_sync_log IS 'Historia synchronizacji faktur z KSeF';
COMMENT ON TABLE ksef_invoice_queue IS 'Kolejka faktur z KSeF czekających na przypisanie do wspólnoty';
