-- Add reminder_sent_at to track when 24h reminder was sent
ALTER TABLE votes ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;
