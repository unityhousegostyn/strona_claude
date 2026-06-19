-- Dodaje pola potrzebne do generowania zawiadomień o wysokości opłat
-- (numer konta bankowego + podstawa prawna), ustawiane raz per wspólnota
-- i wykorzystywane we wszystkich zawiadomieniach tej wspólnoty.

alter table communities
  add column if not exists bank_account text,
  add column if not exists legal_basis text;
