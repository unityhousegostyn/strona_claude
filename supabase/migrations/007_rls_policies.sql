-- =============================================
-- RLS POLICIES — druga warstwa bezpieczeństwa
-- Uruchom w Supabase SQL Editor
-- =============================================

-- Włącz RLS na wszystkich tabelach
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_communities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs      ENABLE ROW LEVEL SECURITY;

-- =============================================
-- profiles
-- =============================================
-- Każdy zalogowany user może czytać swój profil
CREATE POLICY "profiles: read own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Service role (admin client) może wszystko — nie wymaga polityki bo omija RLS

-- =============================================
-- communities
-- =============================================
-- Zalogowani users mogą czytać swoją wspólnotę
CREATE POLICY "communities: read own" ON communities
  FOR SELECT USING (
    id IN (
      SELECT community_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Zapis tylko przez service role (już blokujemy w kodzie)
-- Brak polityki INSERT/UPDATE/DELETE = zablokowane dla anon/user

-- =============================================
-- announcements
-- =============================================
CREATE POLICY "announcements: read active" ON announcements
  FOR SELECT USING (
    -- super_admin widzi wszystko (sprawdzane przez service role w kodzie)
    -- tu chodzi o anon client — user widzi ogłoszenia swojej wspólnoty
    target = 'all'
    OR (
      target = 'one' AND community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR (
      target = 'selected' AND id IN (
        SELECT announcement_id FROM announcement_communities
        WHERE community_id IN (
          SELECT community_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- =============================================
-- documents
-- =============================================
CREATE POLICY "documents: read own community" ON documents
  FOR SELECT USING (
    target = 'all'
    OR (
      target = 'one' AND community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR (
      target = 'selected' AND id IN (
        SELECT document_id FROM document_communities
        WHERE community_id IN (
          SELECT community_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- =============================================
-- tickets
-- =============================================
CREATE POLICY "tickets: read own community" ON tickets
  FOR SELECT USING (
    community_id IN (
      SELECT community_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "tickets: insert own community" ON tickets
  FOR INSERT WITH CHECK (
    community_id IN (
      SELECT community_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =============================================
-- ticket_comments
-- =============================================
CREATE POLICY "ticket_comments: read if ticket visible" ON ticket_comments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM tickets WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "ticket_comments: insert own" ON ticket_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND ticket_id IN (
      SELECT id FROM tickets WHERE community_id IN (
        SELECT community_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =============================================
-- read_announcements
-- =============================================
CREATE POLICY "read_announcements: own" ON read_announcements
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- activity_logs
-- =============================================
-- Tylko service role może czytać/pisać logi
-- Brak polityki = zablokowane dla anon/user
