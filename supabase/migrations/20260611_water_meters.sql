-- Migration: water meter readings module
-- Run in Supabase SQL Editor

-- 1. Enable water meter module per community
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS water_meter_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Pin announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Water meter readings table
CREATE TABLE IF NOT EXISTS water_meter_readings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apartment_id  UUID NOT NULL REFERENCES settlement_apartments(id) ON DELETE CASCADE,
  community_id  UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reading_value NUMERIC(10, 3) NOT NULL,
  reading_date  DATE NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  rejection_reason TEXT,
  confirmed_at  TIMESTAMPTZ,
  confirmed_by  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE water_meter_readings ENABLE ROW LEVEL SECURITY;

-- Users see only their own readings
CREATE POLICY "users_own_readings" ON water_meter_readings
  FOR SELECT USING (user_id = auth.uid());

-- Admins/super_admin see all readings (via service role in server actions)
-- Service role bypasses RLS, so no extra policy needed for admin panel.

-- 5. Index for monthly duplicate check
CREATE INDEX IF NOT EXISTS idx_water_readings_apt_date
  ON water_meter_readings (apartment_id, reading_date);
