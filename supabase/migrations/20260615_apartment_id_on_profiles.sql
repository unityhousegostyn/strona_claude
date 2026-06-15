-- Add apartment_id to profiles for many-to-one user→apartment relationship
-- This allows multiple users (profiles) to be linked to the same apartment
-- Replaces the single-owner owner_id approach on settlement_apartments

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS apartment_id UUID REFERENCES settlement_apartments(id) ON DELETE SET NULL;

-- Migrate existing owner_id assignments to profiles.apartment_id
UPDATE profiles p
SET apartment_id = sa.id
FROM settlement_apartments sa
WHERE sa.owner_id = p.id;
