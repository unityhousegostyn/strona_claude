-- =============================================
-- RLS HARDENING — domknięcie tabel bez ochrony
-- Uruchom w Supabase SQL Editor
--
-- Kontekst: w tym systemie WSZYSTKIE zapisy/odczyty z panelu idą przez
-- service-role klienta (getSupabaseAdminClient), który całkowicie omija RLS.
-- RLS jest więc jedyną zaporą chroniącą przed odpytaniem REST API Supabase
-- bezpośrednio (poza aplikacją) publicznym kluczem anon + tokenem JWT
-- zalogowanego użytkownika. Poniższe tabele nie miały włączonego RLS wcale,
-- co pozwalało każdemu zalogowanemu (a w przypadku invitations — nawet
-- niezalogowanemu) odpytać dane WSZYSTKICH wspólnot, nie tylko własnej.
--
-- Dodajemy tylko polityki SELECT (odczyt własnej wspólnoty/własnych danych).
-- Zapis (INSERT/UPDATE/DELETE) zostaje celowo bez polityk = zablokowany dla
-- anon/authenticated, bo i tak całość zapisu w aplikacji idzie przez service
-- role w server actions/route handlers — tak jak już jest zrobione dla
-- `communities`, `documents`, `activity_logs` w 007_rls_policies.sql.
-- =============================================

ALTER TABLE settlement_apartments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_rates                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_opening_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_water_reconciliation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_choices                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_posts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_replies                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                       ENABLE ROW LEVEL SECURITY;

-- =============================================
-- settlement_apartments / settlement_rates
-- =============================================
CREATE POLICY "settlement_apartments: read own community" ON settlement_apartments
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "settlement_rates: read own community" ON settlement_rates
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

-- =============================================
-- settlement_entries / settlement_opening_balances / settlement_water_reconciliation
-- (kluczowane przez apartment_id — community_id dociągamy przez settlement_apartments)
-- =============================================
CREATE POLICY "settlement_entries: read own community" ON settlement_entries
  FOR SELECT USING (
    apartment_id IN (
      SELECT id FROM settlement_apartments WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "settlement_opening_balances: read own community" ON settlement_opening_balances
  FOR SELECT USING (
    apartment_id IN (
      SELECT id FROM settlement_apartments WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "settlement_water_reconciliation: read own community" ON settlement_water_reconciliation
  FOR SELECT USING (
    apartment_id IN (
      SELECT id FROM settlement_apartments WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =============================================
-- votes / vote_choices
-- =============================================
CREATE POLICY "votes: read own community" ON votes
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "vote_choices: read own community" ON vote_choices
  FOR SELECT USING (
    vote_id IN (
      SELECT id FROM votes WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =============================================
-- document_chunks (fragmenty dokumentów do czatu AI)
-- =============================================
CREATE POLICY "document_chunks: read own community" ON document_chunks
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

-- =============================================
-- board_posts / board_replies (tablica ogłoszeń)
-- =============================================
CREATE POLICY "board_posts: read own community" ON board_posts
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "board_replies: read if post visible" ON board_replies
  FOR SELECT USING (
    post_id IN (
      SELECT id FROM board_posts WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =============================================
-- contacts
-- =============================================
CREATE POLICY "contacts: read own community" ON contacts
  FOR SELECT USING (
    community_id IN (SELECT community_id FROM profiles WHERE id = auth.uid())
  );

-- =============================================
-- notifications — tylko własne, czytanie i oznaczanie jako przeczytane
-- =============================================
CREATE POLICY "notifications: own only" ON notifications
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- invitations / audit_logs
-- =============================================
-- Brak CREATE POLICY = całkowicie zablokowane dla anon/authenticated.
-- invitations zawiera tokeny zaproszeń + e-maile — dostęp wyłącznie przez
-- service role w app/register/actions.ts i app/admin/users/actions.ts.
-- audit_logs jest czytane wyłącznie przez service role w dashboardzie super_admina.
