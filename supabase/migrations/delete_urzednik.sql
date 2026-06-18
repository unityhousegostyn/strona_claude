-- ============================================================
-- USUŃ WSZELKIE DANE WSPÓLNOTY "Urzędnik"
-- Uruchom najpierw SELECT żeby zweryfikować community_id,
-- potem odkomentuj blok DELETE.
-- ============================================================

-- KROK 1: Znajdź community_id
SELECT id, name, address FROM communities WHERE name ILIKE '%rzędnik%' OR name ILIKE '%urzednik%';

-- ============================================================
-- KROK 2: Po weryfikacji ID — wklej je w miejsce <COMMUNITY_ID>
--         i uruchom poniższy blok.
-- ============================================================

DO $$
DECLARE
  cid UUID;
BEGIN
  -- Znajdź ID automatycznie po nazwie
  SELECT id INTO cid FROM communities WHERE name ILIKE '%rzędnik%' OR name ILIKE '%urzednik%' LIMIT 1;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono wspólnoty Urzędnik — sprawdź nazwę w tabeli communities.';
  END IF;

  RAISE NOTICE 'Usuwam dane wspólnoty: %', cid;

  -- ── Tabele z ON DELETE CASCADE (usuną się automatycznie przy DELETE communities) ──
  -- community_expenses, community_income, community_deposits,
  -- community_requests, water_meter_readings

  -- ── Tabele BEZ CASCADE — usuwamy ręcznie, od liści do korzenia ──

  -- Głosowania: choices → votes
  DELETE FROM vote_choices
    WHERE vote_id IN (SELECT id FROM votes WHERE community_id = cid);
  DELETE FROM votes WHERE community_id = cid;

  -- Tablica ogłoszeń: replies → posts
  DELETE FROM board_replies
    WHERE post_id IN (SELECT id FROM board_posts WHERE community_id = cid);
  DELETE FROM board_posts WHERE community_id = cid;

  -- Zgłoszenia: komentarze → tickets
  DELETE FROM ticket_comments
    WHERE ticket_id IN (SELECT id FROM tickets WHERE community_id = cid);
  DELETE FROM tickets WHERE community_id = cid;

  -- Ogłoszenia: junction → announcements (tylko te z community_id = cid, nie globalne)
  DELETE FROM announcement_communities WHERE community_id = cid;
  DELETE FROM announcements
    WHERE community_id = cid
      AND id NOT IN (SELECT announcement_id FROM announcement_communities);

  -- Dokumenty: junction → documents
  DELETE FROM document_communities WHERE community_id = cid;
  DELETE FROM documents
    WHERE community_id = cid
      AND id NOT IN (SELECT document_id FROM document_communities);

  -- Rozliczenia: wpisy → bilanse otwarcia → rozliczenia wody → stawki → lokale
  DELETE FROM settlement_entries
    WHERE apartment_id IN (SELECT id FROM settlement_apartments WHERE community_id = cid);
  DELETE FROM settlement_opening_balances
    WHERE apartment_id IN (SELECT id FROM settlement_apartments WHERE community_id = cid);
  DELETE FROM settlement_water_reconciliation
    WHERE apartment_id IN (SELECT id FROM settlement_apartments WHERE community_id = cid);
  DELETE FROM settlement_rates WHERE community_id = cid;
  DELETE FROM settlement_apartments WHERE community_id = cid;

  -- Kontakty
  DELETE FROM contacts WHERE community_id = cid;

  -- Powiadomienia
  DELETE FROM notifications
    WHERE user_id IN (SELECT id FROM profiles WHERE community_id = cid);

  -- Logi aktywności (powiązane przez user_id)
  DELETE FROM activity_logs
    WHERE user_id IN (SELECT id FROM profiles WHERE community_id = cid);

  -- Profile użytkowników — odepnij od wspólnoty (nie usuwaj kont auth!)
  UPDATE profiles SET community_id = NULL, apartment_id = NULL WHERE community_id = cid;

  -- Na końcu — usuń samą wspólnotę (CASCADE usunie resztę tabel z FK CASCADE)
  DELETE FROM communities WHERE id = cid;

  RAISE NOTICE 'Gotowe — wspólnota % usunięta.', cid;
END $$;
