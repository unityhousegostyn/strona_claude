-- =============================================
-- Backfill year/month w community_expenses i community_income
-- Uruchom w Supabase SQL Editor
--
-- Przyczyna: addExpense/updateExpense (Koszty) i addIncome/updateIncome
-- (Przychody) nigdy nie zapisywały kolumn year/month — tylko expense_date /
-- income_date. Raporty filtrują po year/month, więc każdy koszt/przychód
-- wpisany przez panel (nie zaimportowany hurtowo z innym skryptem) miał tam
-- NULL i był całkowicie niewidoczny w Raportach (Plan gospodarczy, Sprawozdanie,
-- Rozliczenie, Zadłużenia). Kod już naprawiony — to poniżej naprawia dane,
-- które już są w bazie.
-- =============================================

UPDATE community_expenses
SET
  year  = EXTRACT(YEAR  FROM expense_date)::int,
  month = EXTRACT(MONTH FROM expense_date)::int
WHERE expense_date IS NOT NULL
  AND (year  IS DISTINCT FROM EXTRACT(YEAR  FROM expense_date)::int
   OR  month IS DISTINCT FROM EXTRACT(MONTH FROM expense_date)::int);

UPDATE community_income
SET
  year  = EXTRACT(YEAR  FROM income_date)::int,
  month = EXTRACT(MONTH FROM income_date)::int
WHERE income_date IS NOT NULL
  AND (year  IS DISTINCT FROM EXTRACT(YEAR  FROM income_date)::int
   OR  month IS DISTINCT FROM EXTRACT(MONTH FROM income_date)::int);
