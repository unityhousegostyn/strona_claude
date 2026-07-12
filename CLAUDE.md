@AGENTS.md

# Konwencja: audyt bezpieczeństwa na słowo-trigger

Jeśli użytkownik napisze samo słowo "bezieczenstwo" (lub "bezpieczenstwo"/"bezpieczeństwo") — nawet bez dalszego kontekstu — Claude ma:
1. Uruchomić `npm run security` (scripts/security-audit.sh) i pokazać wynik.
2. Dla każdego znalezionego problemu: naprawić samodzielnie (nie tylko zaraportować).
3. Po naprawkach uruchomić `npm run security` ponownie — musi zwrócić exit 0.
4. Uruchomić `npx tsc --noEmit` i zrobić git commit.
5. Na końcu podsumować co znaleziono i naprawiono.

Skrypt pokrywa: hardcoded secrets, admin client bez auth, IDOR (brak ochrony community_id),
XSS, javascript: URL w SW, cron bez CRON_SECRET, enum bez allowlist, SQL injection, rate limiting.
