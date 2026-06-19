-- ============================================================
-- NAPRAWA POLSKICH ZNAKÓW — RUNDA 4 (finalna)
-- 3 pozostałe wiersze
-- ============================================================

-- ── Ź w PAŹDZIERNIK ─────────────────────────────────────────────
UPDATE community_expenses
SET description = REPLACE(description,
  'PA' || chr(65533) || 'DZIERNIK',  'PAŹDZIERNIK')
WHERE description LIKE '%PA' || chr(65533) || 'DZIERNIK%';

UPDATE community_expenses
SET description = REPLACE(description,
  'PA' || chr(65533) || 'DZIERNIKA', 'PAŹDZIERNIKA')
WHERE description LIKE '%PA' || chr(65533) || 'DZIERNIKA%';

-- fallback na skróty / inne formy
UPDATE community_expenses
SET description = REPLACE(description,
  'PA' || chr(65533) || 'DZIER',     'PAŹDZIERN')
WHERE description LIKE '%PA' || chr(65533) || 'DZIER%';

-- ── Ś w OŚWIETLENIE / ŚWIETLENIE ────────────────────────────────
UPDATE community_expenses
SET description = REPLACE(description,
  chr(65533) || 'WIETL', 'ŚWIETL')
WHERE description LIKE '%' || chr(65533) || 'WIETL%';

UPDATE community_expenses
SET description = REPLACE(description,
  'O' || chr(65533) || 'WIETL', 'OŚWIETL')
WHERE description LIKE '%' || chr(65533) || 'WIETL%';

-- ── □ przed rokiem (izolowany stray char — usuń) ────────────────
-- np. "ŚMIECI□ 2025" → "ŚMIECI 2025"
UPDATE community_expenses
SET description = REPLACE(description,
  chr(65533) || ' 20', ' 20')
WHERE description LIKE '%' || chr(65533) || ' 20%';

-- jeśli bezpośrednio przed cyfrą bez spacji
UPDATE community_expenses
SET description = REPLACE(description,
  chr(65533) || '20', ' 20')
WHERE description LIKE '%' || chr(65533) || '20%';

-- ── Sprawdź co jeszcze zostało ───────────────────────────────────
SELECT id,
       description,
       strpos(description, chr(65533)) AS pozycja,
       substr(description,
         GREATEST(1, strpos(description, chr(65533)) - 5),
         11) AS kontekst
FROM community_expenses
WHERE description LIKE '%' || chr(65533) || '%'
ORDER BY kontekst;
