-- Saldo początkowe konta bankowego wspólnoty (stan na dzień rozpoczęcia
-- śledzenia finansów w panelu) — bez tego "Stan konta" na dashboardzie
-- liczył się tylko z wpłat/kosztów wprowadzonych w systemie, ignorując
-- pieniądze, które wspólnota miała na koncie wcześniej.
alter table communities
  add column if not exists opening_balance numeric(12,2) not null default 0,
  add column if not exists opening_balance_date date;
