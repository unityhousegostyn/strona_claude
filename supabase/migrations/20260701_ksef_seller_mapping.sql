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

-- Bootstrap: wypełnij z już istniejących zaimportowanych faktur
-- Bierze najnowszą kategorię dla każdej pary (community_id, seller_nip)
INSERT INTO ksef_seller_mapping (community_id, seller_nip, seller_name, category, updated_at)
SELECT DISTINCT ON (q.community_id, q.seller_nip)
  q.community_id,
  q.seller_nip,
  q.seller_name,
  e.category,
  NOW()
FROM ksef_invoice_queue q
JOIN community_expenses e ON e.id = q.expense_id
WHERE q.status = 'imported'
  AND q.seller_nip IS NOT NULL
  AND q.community_id IS NOT NULL
  AND q.expense_id IS NOT NULL
ORDER BY q.community_id, q.seller_nip, q.created_at DESC
ON CONFLICT (community_id, seller_nip) DO NOTHING;
