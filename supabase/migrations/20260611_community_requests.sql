-- Wnioski mieszkańców do administracji
CREATE TABLE IF NOT EXISTS community_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  UUID        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'inne'
                            CHECK (type IN ('zaswiadczenie_zamieszkania','zaswiadczenie_niezalegania','zmiana_danych','naprawa','dokumenty','inne')),
  title         TEXT        NOT NULL,
  description   TEXT,
  status        TEXT        NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','in_progress','done','rejected')),
  admin_note    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks dla szybkiego filtrowania
CREATE INDEX IF NOT EXISTS community_requests_community_id_idx ON community_requests(community_id);
CREATE INDEX IF NOT EXISTS community_requests_user_id_idx      ON community_requests(user_id);
CREATE INDEX IF NOT EXISTS community_requests_status_idx       ON community_requests(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_community_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_requests_updated_at ON community_requests;
CREATE TRIGGER community_requests_updated_at
  BEFORE UPDATE ON community_requests
  FOR EACH ROW EXECUTE FUNCTION update_community_requests_updated_at();

-- RLS
ALTER TABLE community_requests ENABLE ROW LEVEL SECURITY;

-- super_admin: pełny dostęp
CREATE POLICY "super_admin_all_requests" ON community_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- admin: tylko własna wspólnota
CREATE POLICY "admin_own_community_requests" ON community_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND community_id = community_requests.community_id
    )
  );

-- user: tylko własne wnioski (insert + select)
CREATE POLICY "user_own_requests_select" ON community_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_own_requests_insert" ON community_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'user'
        AND community_id = community_requests.community_id
    )
  );
