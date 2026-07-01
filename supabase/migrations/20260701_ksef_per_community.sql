-- Per-community KSeF settings
-- Każda wspólnota ma własną konfigurację KSeF (własny NIP i token).

-- 1. Dodaj community_id do ksef_settings
ALTER TABLE ksef_settings
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;

-- 2. Usuń singleton constraint (UNIQUE ON ((true)))
DROP INDEX IF EXISTS ksef_settings_singleton;

-- 3. Dodaj unique per wspólnota
CREATE UNIQUE INDEX IF NOT EXISTS ksef_settings_community_unique
  ON ksef_settings (community_id)
  WHERE community_id IS NOT NULL;

-- 4. Dodaj community_id do ksef_sync_log (do filtrowania historii per wspólnota)
ALTER TABLE ksef_sync_log
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Zaktualizuj komentarz
COMMENT ON TABLE ksef_settings IS 'Konfiguracja integracji KSeF — jeden wiersz per wspólnota';
