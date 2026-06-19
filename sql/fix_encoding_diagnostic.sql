-- KROK 1: Diagnostyka — sprawdź jaki znak siedzi zamiast □
-- Uruchom to PIERWSZE i pokaż mi wyniki

SELECT
  description,
  -- pokaż kod ASCII/Unicode każdego znaku w miejscach gdzie są □
  -- szukamy opisu który zawiera uszkodzony znak
  ascii(substring(description FROM
    -- pozycja pierwszego "dziwnego" znaku (>127 ale nie jest poprawnym UTF-8 polskim)
    (SELECT min(i) FROM generate_series(1, length(description)) i
     WHERE ascii(substring(description FROM i FOR 1)) > 127
       AND ascii(substring(description FROM i FOR 1)) NOT IN (
         -- poprawne kody UTF-8 pierwszych bajtów polskich liter (jako kodepointy)
         260,261, -- Ą ą
         262,263, -- Ć ć
         280,281, -- Ę ę
         321,322, -- Ł ł
         323,324, -- Ń ń
         211,243, -- Ó ó
         346,347, -- Ś ś
         379,380, -- Ź ź
         380,380, -- Ż ż
         65533     -- U+FFFD replacement char
       )
    ) FOR 1
  )) AS kod_blednego_znaku,
  -- hex reprezentacja dla pewności
  encode(substring(description FROM 1 FOR 40)::bytea, 'hex') AS hex_opis
FROM community_expenses
WHERE description ~ '[^\x00-\x7F]'  -- ma jakikolwiek non-ASCII
  AND description !~ '[ĄĆĘŁŃÓŚŹŻąćęłńóśźż]'  -- ale NIE ma poprawnych polskich znaków
LIMIT 10;
