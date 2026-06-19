-- ============================================================
-- NAPRAWA POLSKICH ZNAKÓW — RUNDA 3
-- ============================================================

-- ── Ł zastąpione zwykłym L (bez □ — inny rodzaj błędu importu) ─
UPDATE community_expenses SET description = REPLACE(description, 'OPLATA',   'OPŁATA')   WHERE description LIKE '%OPLATA%';
UPDATE community_expenses SET description = REPLACE(description, 'ZAKLAD',   'ZAKŁAD')   WHERE description LIKE '%ZAKLAD%';
UPDATE community_expenses SET description = REPLACE(description, 'USLUG',    'USŁUG')    WHERE description LIKE '%USLUG%';
UPDATE community_expenses SET description = REPLACE(description, 'WODOCIAG', 'WODOCIĄG') WHERE description LIKE '%WODOCIAG%';

-- ── Ó zastąpione □ w końcówkach (np. WODOCIĄGÓW, ODBIÓRÓW) ─────
UPDATE community_expenses SET description = REPLACE(description, 'WODOCIĄG' || chr(65533) || 'W', 'WODOCIĄGÓW') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'ODBI'     || chr(65533) || 'R', 'ODBIÓR')     WHERE description LIKE '%' || chr(65533) || '%';  -- zabezpieczenie gdyby zostały

-- ── Ś zastąpione □ (np. ŚMIECI, ŚMIECIAMI) ─────────────────────
UPDATE community_expenses SET description = REPLACE(description, chr(65533) || 'MIECI',    'ŚMIECI')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, chr(65533) || 'MIETNIK',  'ŚMIETNIK')  WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, chr(65533) || 'RODEK',    'ŚRODEK')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, chr(65533) || 'WIADCZEN', 'ŚWIADCZEN') WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ó zastąpione □ w innych kontekstach ─────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'W' || chr(65533) || 'DKA',   'WÓDKA')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'KSI' || chr(65533) || 'GI',  'KSIĄŻKI')  WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'SP' || chr(65533) || 'LKA',  'SPÓŁKA')   WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'SP' || chr(65533) || 'LKI',  'SPÓŁKI')   WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ź / Ż zastąpione □ ──────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, chr(65533) || 'R' || chr(65533) || 'D', 'ŹRÓDŁ') WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ostatni fallback: wszystkie □ które zostały ─────────────────
-- Pokaż pozostałe z otoczeniem (3 znaki przed i po □) żeby dopasować wzorzec
SELECT
  id,
  description,
  -- znajdź pozycję pierwszego □
  strpos(description, chr(65533)) AS pozycja,
  -- pokaż kontekst ±5 znaków wokół □
  substr(description,
    GREATEST(1, strpos(description, chr(65533)) - 5),
    11
  ) AS kontekst
FROM community_expenses
WHERE description LIKE '%' || chr(65533) || '%'
ORDER BY kontekst;
