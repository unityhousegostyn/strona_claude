-- UWAGA: NIE usuwamy FK na activity_logs.user_id → profiles(id).
-- Powód: PostgREST używa tej FK do rozwiązania join-a w zapytaniu:
--   .select('*, actor:profiles!user_id(full_name, email)')
-- Bez FK zapytanie zwróciłoby błąd "Could not find foreign key".
--
-- Zamiast tego obsługujemy naruszenie FK (error 23503) w kodzie aplikacji
-- (lib/audit.ts) — retry z user_id = NULL i userId zachowanym w meta.
--
-- Ta migracja jest celowo pusta (no-op).
SELECT 1;
