-- Numer uchwały per wspólnota per rok
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS resolution_number INTEGER;

-- Uzupełnij istniejące uchwały numerami (per wspólnota, rok, wg daty created_at)
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY community_id, EXTRACT(year FROM created_at)
      ORDER BY created_at
    )::INTEGER AS rn
  FROM votes
)
UPDATE votes v
SET resolution_number = n.rn
FROM numbered n
WHERE v.id = n.id AND v.resolution_number IS NULL;
