-- Numer faktury wystawcy (np. "FV/001/2026") — oddzielny od numeru KSeF
ALTER TABLE ksef_invoice_queue
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;
