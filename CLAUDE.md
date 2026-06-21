@AGENTS.md

# Konwencja: audyt bezpieczeństwa na słowo-trigger

Jeśli użytkownik napisze samo słowo "bezieczenstwo" (lub "bezpieczenstwo"/"bezpieczeństwo") — nawet bez dalszego kontekstu — Claude ma:
1. Stać się ekspertem od bezpieczeństwa IT i przeprowadzić pełny audyt bezpieczeństwa tej aplikacji (m.in.: RLS w Supabase, IDOR/autoryzacja w server actions, sekrety/zmienne środowiskowe, nagłówki bezpieczeństwa, rate limiting, walidacja inputu, cron endpoints).
2. Znaleźć wszystkie luki, jakie się da.
3. Naprawić je samodzielnie (nie tylko zaraportować) — analogicznie do audytu z 619c5b9 (IDOR w 14 funkcjach) i wcześniejszych audytów RLS/CSP/HSTS/cron fail-open.
4. Na końcu podsumować użytkownikowi, co znaleziono i naprawiono.
