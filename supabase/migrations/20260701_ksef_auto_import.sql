-- KSeF: auto-import faktur po dopasowaniu NIP
ALTER TABLE ksef_settings
  ADD COLUMN IF NOT EXISTS auto_import BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ksef_settings.auto_import IS
  'Jeśli true i buyer_nip pasuje do NIP wspólnoty — faktura trafia od razu do community_expenses';
