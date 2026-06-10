// Uruchom: node scripts/generate-vapid-keys.mjs
// Wyniki wklej do .env.local

import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('\n=== VAPID Keys ===\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log(`VAPID_EMAIL=mailto:admin@twojadomena.pl`)
console.log('\nSkopiuj powyższe do pliku .env.local\n')
