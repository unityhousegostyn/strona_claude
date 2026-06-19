-- ============================================================
-- NAPRAWA POLSKICH ZNAKÓW — RUNDA 2
-- Na podstawie wyników diagnostyki
-- ============================================================

-- ── Ł (brakujące z rundy 1) ─────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'OBS'   || chr(65533) || 'UGI',    'OBSŁUGI')    WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'ZAK'   || chr(65533) || 'AD',     'ZAKŁAD')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'PE'    || chr(65533) || 'NOMOC',  'PEŁNOMOC')   WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'OP'    || chr(65533) || '.',      'OPŁ.')       WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'Tytu'  || chr(65533) || ':',      'Tytuł:')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'tytu'  || chr(65533) || ':',      'tytuł:')     WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ą (brakujące) ───────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'SPRZ'   || chr(65533) || 'TANIE', 'SPRZĄTANIE') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'WODOCI' || chr(65533) || 'G',     'WODOCIĄG')   WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ę ───────────────────────────────────────────────────────
UPDATE community_expenses SET description = REPLACE(description, 'KART'     || chr(65533) || ' ',   'KARTĘ ')     WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'UPRAWNIE' || chr(65533),           'UPRAWNIEŃ')  WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ń (brakujące + warianty z spacją w środku) ──────────────
UPDATE community_expenses SET description = REPLACE(description, 'GOSTY' || chr(65533),              'GOSTYŃ')     WHERE description LIKE '%' || chr(65533) || '%';

-- Warianty LESZCZYŃSKIEGO z różnymi spacjami (błędy importu)
UPDATE community_expenses SET description = REPLACE(description, 'LESZ CZY' || chr(65533) || 'SKIEGO',  'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZC ZY' || chr(65533) || 'SKIEGO',  'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZCZ Y' || chr(65533) || 'SKIEGO',  'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZCZY ' || chr(65533) || 'SKIEGO',  'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LE SZCZY' || chr(65533) || 'SKIEGO',  'LESZCZYŃSKIEGO') WHERE description LIKE '%' || chr(65533) || '%';
UPDATE community_expenses SET description = REPLACE(description, 'LESZ CZY' || chr(65533) || 'SKIM',    'LESZCZYŃSKIM')   WHERE description LIKE '%' || chr(65533) || '%';

-- ── Ogólny fallback — wszystko co zostało z □ i nie pasuje ──
-- Pokaż co jeszcze zostało nienaprawione
SELECT id, description
FROM community_expenses
WHERE description LIKE '%' || chr(65533) || '%'
ORDER BY description;
