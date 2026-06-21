-- Saldo początkowe wspólnoty (stan na dzień rozpoczęcia śledzenia finansów
-- w panelu) — bez tego "Stan konta" na dashboardzie liczył się tylko z
-- wpłat/kosztów wprowadzonych w systemie, ignorując pieniądze, które
-- wspólnota miała wcześniej. Rozbite na dwa fundusze (eksploatacyjny i
-- remontowy), bo zgodnie z UWL są to dwa odrębne, niemieszane fundusze.
alter table communities
  add column if not exists opening_balance_eksploatacyjny numeric(12,2) not null default 0,
  add column if not exists opening_balance_remont numeric(12,2) not null default 0,
  add column if not exists opening_balance_date date;
