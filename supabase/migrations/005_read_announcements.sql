-- Tabela śledząca przeczytane ogłoszenia
CREATE TABLE IF NOT EXISTS read_announcements (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX IF NOT EXISTS read_announcements_user_id_idx ON read_announcements(user_id);
