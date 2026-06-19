-- =============================================
-- Trzeci model rozliczania wody: 'zaliczka' (samonaliczenie mieszkańca)
-- Uruchom w Supabase SQL Editor
--
-- Kolumna settlement_rates.water_billing_type nie ma migracji źródłowej
-- (dodana wcześniej poza repo) — jeśli ma CHECK constraint ograniczający
-- wartości do 'ryczalt'/'meter', poniższe bezpiecznie go zdejmuje i zakłada
-- nowy, dopuszczający też 'zaliczka'. Jeśli to zwykła kolumna text bez
-- ograniczenia, DROP CONSTRAINT IF EXISTS jest no-opem — nic się nie stanie.
-- =============================================

ALTER TABLE settlement_rates
  DROP CONSTRAINT IF EXISTS settlement_rates_water_billing_type_check;

ALTER TABLE settlement_rates
  ADD CONSTRAINT settlement_rates_water_billing_type_check
  CHECK (water_billing_type IN ('ryczalt', 'meter', 'zaliczka'));
