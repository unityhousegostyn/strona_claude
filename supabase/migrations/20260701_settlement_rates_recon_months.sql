-- Konfigurowalny okres rozliczenia wody
-- Zamiast hardkodowanego kwartału (3 miesiące), admin może wybrać
-- dowolny okres będący dzielnikiem 12: 1, 2, 3, 4, 6, 12 miesięcy.
ALTER TABLE settlement_rates
  ADD COLUMN IF NOT EXISTS water_reconciliation_months INT NOT NULL DEFAULT 3
    CHECK (water_reconciliation_months IN (1, 2, 3, 4, 6, 12));

COMMENT ON COLUMN settlement_rates.water_reconciliation_months IS
  'Okres rozliczenia wody w miesiącach (dzielnik 12). Domyślnie: 3 (kwartał).';
