import crypto from 'crypto'

/** Hashuj PIN przy użyciu scrypt (wbudowany Node.js crypto) */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (err, key) => {
      if (err) reject(err)
      else resolve(key.toString('hex'))
    })
  })
  return `${salt}:${hash}`
}

/** Zweryfikuj PIN względem zapisanego hasha */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(pin, salt, 32, (err, key) => {
      if (err) reject(err)
      else resolve(key.toString('hex'))
    })
  })
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}
