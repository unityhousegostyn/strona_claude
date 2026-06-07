-- Tabela komentarzy do zgłoszeń
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_id_idx ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_comments_author_id_idx ON ticket_comments(author_id);
