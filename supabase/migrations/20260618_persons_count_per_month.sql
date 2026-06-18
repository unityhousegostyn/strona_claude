-- Możliwość nadpisania liczby osób per miesiąc (opłaty za śmieci)
-- NULL = używa domyślnej wartości z settlement_apartments.persons_count
ALTER TABLE settlement_entries ADD COLUMN IF NOT EXISTS persons_count INTEGER NULL;
