-- Zasilenie community_budgets danymi z community_expenses
-- Plan = rzeczywiste wydatki per (wspólnota, rok, kategoria)
-- Logika: każdy rok traktowany osobno; admin może potem korygować plany

INSERT INTO community_budgets (community_id, year, category, planned_amount, updated_at)
SELECT
  community_id,
  EXTRACT(YEAR FROM expense_date::date)::integer AS year,
  COALESCE(NULLIF(TRIM(category), ''), 'pozostałe')   AS category,
  ROUND(SUM(amount)::numeric, 2)                       AS planned_amount,
  NOW()
FROM community_expenses
WHERE expense_date IS NOT NULL
  AND community_id IS NOT NULL
GROUP BY
  community_id,
  EXTRACT(YEAR FROM expense_date::date),
  COALESCE(NULLIF(TRIM(category), ''), 'pozostałe')
ON CONFLICT (community_id, year, category)
  DO UPDATE SET
    planned_amount = EXCLUDED.planned_amount,
    updated_at     = NOW();
