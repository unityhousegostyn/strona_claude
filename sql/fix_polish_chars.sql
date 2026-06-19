-- ============================================================
-- NAPRAWA POLSKICH ZNAKÓW W community_expenses
-- Znak U+FFFD (chr(65533) = □) zastąpił polskie litery przy imporcie
-- Uruchom w Supabase SQL Editor (kompatybilne z PG 14/15)
-- ============================================================

-- PODGLĄD przed naprawą
-- SELECT description FROM community_expenses
-- WHERE description LIKE '%' || chr(65533) || '%' ORDER BY description;

-- ── Ł ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'OP' || chr(65533) || 'ATA',     'OPŁATA')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'OP' || chr(65533) || 'AT',      'OPŁAT')      WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'US' || chr(65533) || 'UGOWA',   'USŁUGOWA')   WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'US' || chr(65533) || 'UGI',     'USŁUGI')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'US' || chr(65533) || 'UGA',     'USŁUGA')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'B'  || chr(65533) || 'YSK',     'BŁYSK')      WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'MIECZYS' || chr(65533) || 'AW', 'MIECZYSŁAW') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'STA' || chr(65533) || 'E',      'STAŁE')      WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'STA' || chr(65533) || 'A',      'STAŁA')      WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'STA' || chr(65533) || 'YCH',    'STAŁYCH')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'STA' || chr(65533) || '.',      'STAŁ.')      WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'W' || chr(65533) || 'ASNO',     'WŁASNO')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'W' || chr(65533) || 'ASNI',     'WŁASNI')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'SP' || chr(65533) || 'DZI',     'SPÓŁDZI')    WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ą ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'ZWI' || chr(65533) || 'ZEK',   'ZWIĄZEK')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'ZWI' || chr(65533) || 'ZKU',   'ZWIĄZKU')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'ZARZ' || chr(65533) || 'D',    'ZARZĄD')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'ZARZ' || chr(65533) || 'DZANI','ZARZĄDZANI') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'WSP' || chr(65533) || 'LNO',   'WSPÓLNO')    WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ń ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'LESZCZY' || chr(65533) || 'SKIEGO', 'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZCZY' || chr(65533) || 'SKIM',   'LESZCZYŃSKIM')   WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZCZY' || chr(65533) || 'SKI',    'LESZCZYŃSKI')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'POZNA'   || chr(65533) || 'SKI',    'POZNAŃSKI')      WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ó ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'ODBI'   || chr(65533) || 'R',     'ODBIÓR')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'WSP'    || chr(65533) || 'LNOTA', 'WSPÓLNOTA') WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ś ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'NIERUCHOMO' || chr(65533) || 'CI', 'NIERUCHOMOŚCI') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'O'          || chr(65533) || 'WIADCZEN', 'OŚWIADCZEN') WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ę ──────────────────────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'WEWN' || chr(65533) || 'TRZNE', 'WEWNĘTRZNE') WHERE description LIKE '%' || chr(65533) || '%';

-- ============================================================
-- SPRAWDŹ co zostało — te opisy wymagają ręcznej korekty
-- ============================================================
SELECT id, description
FROM community_expenses
WHERE description LIKE '%' || chr(65533) || '%'
ORDER BY description;
