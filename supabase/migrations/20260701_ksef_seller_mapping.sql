-- KSeF: pamięć kategorii per sprzedawca (seller_nip → category)
-- Wypełniana automatycznie przy ręcznym imporcie z kolejki.
-- Używana przy auto-imporcie zamiast guessCategory.

CREATE TABLE IF NOT EXISTS ksef_seller_mapping (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  seller_nip   VARCHAR(10) NOT NULL,
  seller_name  VARCHAR(255),
  category     VARCHAR(100) NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (community_id, seller_nip)
);

COMMENT ON TABLE ksef_seller_mapping IS
  'Zapamiętane kategorie kosztów per NIP sprzedawcy i wspólnota — używane przy auto-imporcie KSeF';

-- RLS
ALTER TABLE ksef_seller_mapping ENABLE ROW LEVEL SECURITY;
-- Dostęp tylko przez getSupabaseAdminClient (service_role) — brak polis dla anonimowych
