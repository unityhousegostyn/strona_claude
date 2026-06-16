-- Jedno mieszkanie = jeden głos w uchwale
-- Zmiana unique constraint z (vote_id, user_id) na (vote_id, apartment_id)

-- 1. Usuń stare duplikaty — jeśli kilku użytkowników z tego samego lokalu już głosowało,
--    zachowaj jeden wiersz (o niższym ctid), usuń pozostałe
DELETE FROM vote_choices
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM vote_choices
  WHERE apartment_id IS NOT NULL
  GROUP BY vote_id, apartment_id
)
AND apartment_id IS NOT NULL;

-- 2. Usuń stary constraint (vote_id, user_id) jeśli istnieje
ALTER TABLE vote_choices
  DROP CONSTRAINT IF EXISTS vote_choices_vote_id_user_id_key;

-- 3. Dodaj nowy constraint (vote_id, apartment_id) dla lokali
--    NULL apartment_id jest dozwolony (admini bez lokalu mogą głosować testowo)
CREATE UNIQUE INDEX IF NOT EXISTS vote_choices_vote_apartment_unique
  ON vote_choices (vote_id, apartment_id)
  WHERE apartment_id IS NOT NULL;
