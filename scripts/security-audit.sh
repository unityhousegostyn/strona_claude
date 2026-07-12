#!/usr/bin/env bash
# =============================================================================
# security-audit.sh — globalny statyczny audyt bezpieczeństwa
# Uruchom: bash scripts/security-audit.sh  lub  npm run security
# Exit 0 = czysto, Exit 1 = znaleziono problemy
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
ISSUES=0

banner() { echo -e "${BOLD}── $1 ${NC}"; }

echo -e "\n${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  AUDYT BEZPIECZEŃSTWA — $(date '+%Y-%m-%d %H:%M')${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}\n"

# ── 1. SEKRETY W KODZIE ──────────────────────────────────────────────────────
banner "1. Hardcoded secrets"
python3 - <<'PYEOF'
import os, re
patterns = [
    (r'(?i)password\s*=\s*["\x27][^"\x27\s]{8,}',       "hardcoded password"),
    (r'(?i)api.?key\s*=\s*["\x27][a-zA-Z0-9_\-]{20,}',  "hardcoded api_key"),
    (r'(?i)\bsecret\s*=\s*["\x27][a-zA-Z0-9_\-]{16,}',  "hardcoded secret"),
]
found = []
for dirpath, _, files in os.walk("."):
    if any(x in dirpath for x in ["node_modules", ".next", ".git", "scripts"]):
        continue
    for fn in files:
        if not fn.endswith((".ts", ".tsx", ".js")):
            continue
        path = os.path.join(dirpath, fn)
        try:
            lines = open(path).readlines()
        except:
            continue
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if s.startswith(("//", "*", "#")):
                continue
            if "process.env" in line or "placeholder" in line.lower():
                continue
            for pat, label in patterns:
                if re.search(pat, line):
                    found.append(f"    {path}:{i}: [{label}] {s[:80]}")
if found:
    print(f"\033[0;31m[KRYTYCZNY]\033[0m\033[1m Potencjalne hardcoded credentials:\033[0m")
    print("\n".join(found))
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Brak hardcoded secrets\n")
PYEOF

# ── 2. ADMIN CLIENT BEZ AUTH ─────────────────────────────────────────────────
banner "2. getSupabaseAdminClient bez sprawdzenia auth"
python3 - <<'PYEOF'
import os

# Znane wzorce auth w tej aplikacji
AUTH_MARKERS = [
    "requireAdminOrAbove", "requireSuperAdmin", "requireAdminOrSuperAdmin",
    "getAuthProfileAction", "getAuthProfile(", "getSupabaseServerClient",
    "auth.getUser", "admin.auth.getUser", "CRON_SECRET",
]
# Pliki które celowo używają admin client bez session auth
SAFE_PATHS = [
    "register/actions",   # publiczna rejestracja
    "lib/votes/close",    # biblioteka wywoływana przez cron
    "lib/email",          # helper email
    "lib/audit",          # helper audit
    "lib/supabase",       # client factory
    "lib/ksef",           # helper KSeF
]

bad = []
for dirpath, _, files in os.walk("."):
    if any(x in dirpath for x in ["node_modules", ".next", ".git", "scripts"]):
        continue
    for fn in files:
        if not fn.endswith((".ts", ".tsx")):
            continue
        path = os.path.join(dirpath, fn)
        if any(s in path for s in SAFE_PATHS):
            continue
        try:
            src = open(path).read()
        except:
            continue
        if "getSupabaseAdminClient" not in src:
            continue
        is_action = "'use server'" in src or '"use server"' in src
        is_api    = "/api/" in path
        if not (is_action or is_api):
            continue
        if not any(m in src for m in AUTH_MARKERS):
            bad.append(path)

if bad:
    print(f"\033[0;31m[WYSOKI]\033[0m\033[1m Admin client bez widocznego auth:\033[0m")
    for p in bad: print(f"    {p}")
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Wszystkie pliki z admin client mają auth\n")
PYEOF

# ── 3. IDOR — BRAK OCHRONY COMMUNITY ────────────────────────────────────────
banner "3. Server Actions bez ochrony community_id (IDOR)"
python3 - <<'PYEOF'
import os

# Wzorce które świadczą o ochronie IDOR
GUARD_MARKERS = [
    "guardCommunity",
    "actorProfile.community_id", "senderProfile.community_id",
    "callerProfile.community_id", "profile.community_id",
    "actor.community_id", ".community_id !== ",
    "communityId",           # komunity ID jako parametr — scopuje zapytania
    "super_admin",           # plik tylko dla super_admin
    "community_id: id",      # update własnej wspólnoty
    "user_id: user.id",      # operuje wyłącznie na własnych danych użytkownika
]
# Pliki bez community scoping celowo (globalne operacje własne użytkownika)
SKIP = ["register", "login", "profile/actions", "notifications", "lib/votes"]

bad = []
for dirpath, _, files in os.walk("app"):
    if any(x in dirpath for x in ["node_modules", ".next"]):
        continue
    for fn in files:
        if fn != "actions.ts":
            continue
        path = os.path.join(dirpath, fn)
        if any(s in path for s in SKIP):
            continue
        try:
            src = open(path).read()
        except:
            continue
        if "getSupabaseAdminClient" not in src:
            continue
        if not any(m in src for m in GUARD_MARKERS):
            bad.append(path)

if bad:
    print(f"\033[1;33m[SPRAWDŹ]\033[0m\033[1m actions.ts bez ochrony community:\033[0m")
    for p in bad: print(f"    {p}")
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Wszystkie actions.ts mają ochronę community\n")
PYEOF

# ── 4. XSS ──────────────────────────────────────────────────────────────────
banner "4. XSS — niebezpieczne wzorce"
python3 - <<'PYEOF'
import os, re
found = []
for dirpath, _, files in os.walk("."):
    if any(x in dirpath for x in ["node_modules", ".next", ".git", "scripts"]):
        continue
    for fn in files:
        if not fn.endswith((".ts", ".tsx", ".js")):
            continue
        path = os.path.join(dirpath, fn)
        try:
            lines = open(path).readlines()
        except:
            continue
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if s.startswith(("//", "*")):
                continue
            if re.search(r'\beval\s*\(', line):
                found.append(f"    {path}:{i}: [eval] {s[:100]}")
            if re.search(r'\.innerHTML\s*=\s*[a-zA-Z_$]', line):
                found.append(f"    {path}:{i}: [innerHTML=var] {s[:100]}")
            if re.search(r'document\.write\s*\(', line):
                found.append(f"    {path}:{i}: [document.write] {s[:100]}")
if found:
    print(f"\033[0;31m[WYSOKI]\033[0m\033[1m Potencjalne XSS:\033[0m")
    print("\n".join(found))
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Brak podejrzanych wzorców XSS\n")
PYEOF

# ── 5. SERVICE WORKER — openWindow BEZ WALIDACJI ────────────────────────────
banner "5. Service Worker — clients.openWindow bez walidacji URL"
python3 - <<'PYEOF'
import os, re
found = []
for fn in ["public/sw.js"]:
    if not os.path.exists(fn):
        continue
    lines = open(fn).readlines()
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if s.startswith("//"):
            continue
        if re.search(r'clients\.openWindow\s*\(', line):
            context = "".join(lines[max(0, i-25):i+5])
            if "protocol" not in context and "startsWith" not in context:
                found.append(f"    {fn}:{i}: openWindow bez walidacji URL — ryzyko XSS")
if found:
    print(f"\033[0;31m[WYSOKI]\033[0m\033[1m Service Worker openWindow bez walidacji:\033[0m")
    print("\n".join(found))
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Service Worker waliduje URL przed openWindow\n")
PYEOF

# ── 6. CRON BEZ CRON_SECRET ─────────────────────────────────────────────────
banner "6. Cron endpoints bez CRON_SECRET"
python3 - <<'PYEOF'
import os
root = "app/api/cron"
if not os.path.isdir(root):
    print("  \033[0;32m✓\033[0m Brak katalogu cron\n")
    exit()
bad = []
for dirpath, _, files in os.walk(root):
    for fn in files:
        if fn != "route.ts": continue
        path = os.path.join(dirpath, fn)
        try:
            src = open(path).read()
        except:
            continue
        if "CRON_SECRET" not in src:
            bad.append(path)
if bad:
    print(f"\033[0;31m[KRYTYCZNY]\033[0m\033[1m Cron bez CRON_SECRET:\033[0m")
    for p in bad: print(f"    {p}")
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Wszystkie cron mają CRON_SECRET\n")
PYEOF

# ── 7. ENUM BEZ RUNTIME ALLOWLIST ───────────────────────────────────────────
banner "7. Pola role/status bez runtime allowlist"
python3 - <<'PYEOF'
import os, re
VALIDATION_MARKERS = [
    ".includes(", "VALID_ROLES", "VALID_STATUSES", "allowedRoles", "z.enum(", "switch(",
]
found = []
for dirpath, _, files in os.walk("app"):
    if any(x in dirpath for x in ["node_modules", ".next"]):
        continue
    for fn in files:
        if not fn.endswith((".ts", ".tsx")): continue
        path = os.path.join(dirpath, fn)
        try:
            src = open(path).read()
            lines = src.splitlines()
        except:
            continue
        has_val = any(m in src for m in VALIDATION_MARKERS)
        if has_val:
            continue
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if s.startswith("//"): continue
            if re.search(r'\b(role|status)\s*:\s*(?:data|input|body|payload)\.\w+', line):
                found.append(f"    {path}:{i}: {s[:100]}")
if found:
    print(f"\033[1;33m[WYSOKI]\033[0m\033[1m Enum bez runtime allowlist:\033[0m")
    print("\n".join(found))
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Pola role/status mają walidację runtime\n")
PYEOF

# ── 8. SQL INJECTION ─────────────────────────────────────────────────────────
banner "8. Raw SQL z interpolacją zmiennych"
python3 - <<'PYEOF'
import os, re
found = []
for dirpath, _, files in os.walk("."):
    if any(x in dirpath for x in ["node_modules", ".next", ".git", "scripts"]):
        continue
    for fn in files:
        if not fn.endswith((".ts", ".tsx")): continue
        path = os.path.join(dirpath, fn)
        try:
            lines = open(path).readlines()
        except:
            continue
        for i, line in enumerate(lines, 1):
            s = line.strip()
            if s.startswith("//"): continue
            if re.search(r'\.rpc\(`[^`]*\$\{', line) or \
               re.search(r'\.query\(`[^`]*\$\{', line) or \
               re.search(r'supabase\.from\(`[^`]*\$\{', line):
                found.append(f"    {path}:{i}: {s[:100]}")
if found:
    print(f"\033[0;31m[KRYTYCZNY]\033[0m\033[1m SQL injection — raw query z template literal:\033[0m")
    print("\n".join(found))
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Brak raw SQL z interpolacją\n")
PYEOF

# ── 9. WRAŻLIWE API BEZ RATE LIMITINGU ──────────────────────────────────────
banner "9. Wrażliwe API routes bez rate limitingu"
python3 - <<'PYEOF'
import os
# Endpointy wrażliwe na brute-force lub abuse (ścieżki, nie substrings)
SENSITIVE  = ["/login/", "/register/", "/reset/", "/invite/", "/chat/"]
# Wszystkie znane nazwy funkcji rate limiting w tej aplikacji
RL_MARKERS = ["rateLimit", "rateLimiter", "checkRateLimit", "checkChatRateLimit"]

no_rl = []
for dirpath, _, files in os.walk("app/api"):
    if "cron" in dirpath: continue
    for fn in files:
        if fn != "route.ts": continue
        path = os.path.join(dirpath, fn)
        if not any(s in path for s in SENSITIVE): continue
        try:
            src = open(path).read()
        except:
            continue
        if not any(m in src for m in RL_MARKERS):
            no_rl.append(path)

if no_rl:
    print(f"\033[1;33m[WYSOKI]\033[0m\033[1m Wrażliwe endpointy bez rate limitingu:\033[0m")
    for p in no_rl: print(f"    {p}")
    print()
    exit(1)
else:
    print("  \033[0;32m✓\033[0m Wrażliwe endpointy mają rate limiting\n")
PYEOF

# ── PODSUMOWANIE ─────────────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓  Skan zakończony — brak wykrytych problemów.${NC}"
echo -e "   Uruchom ponownie: ${BOLD}npm run security${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}\n"
