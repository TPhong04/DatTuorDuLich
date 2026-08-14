import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto'

const ALG = 'aes-256-gcm'
const KEYLEN = 32
const IVLEN = 12
const TAGLEN = 16

export function deriveKey256(secret: string, salt = 'vnexplorer_2fa_salt'): Buffer {
  return scryptSync(Buffer.from(secret, 'utf8'), Buffer.from(salt, 'utf8'), KEYLEN)
}

export function aesGcmEncrypt(plaintext: string, key256: Buffer): string {
  const iv = randomBytes(IVLEN)
  const cipher = createCipheriv(ALG, key256, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function aesGcmDecrypt(ciphertextB64U: string, key256: Buffer): string | null {
  try {
    const buf = Buffer.from(ciphertextB64U, 'base64url')
    if (buf.length < IVLEN + TAGLEN + 1) return null
    const iv = buf.subarray(0, IVLEN)
    const tag = buf.subarray(IVLEN, IVLEN + TAGLEN)
    const enc = buf.subarray(IVLEN + TAGLEN)
    const decipher = createDecipheriv(ALG, key256, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(enc), decipher.final()])
    return plain.toString('utf8')
  } catch {
    return null
  }
}

export function randomBase32(len = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[bytes[i] % 32]
  return out
}

export function randomBackupCodes(n = 6): string[] {
  const codes: string[] = []
  for (let i = 0; i < n; i += 1) {
    const a = randomBytes(3).toString('hex').toUpperCase()
    const b = randomBytes(3).toString('hex').toUpperCase()
    codes.push(`${a}-${b}`)
  }
  return codes
}

export function totpUri(secretBase32: string, email: string, issuer: string): string {
  const enc = (s: string) => encodeURIComponent(s)
  return `otpauth://totp/${enc(issuer)}:${enc(email)}?secret=${enc(secretBase32)}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = (str || '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (let i = 0; i < clean.length; i += 1) {
    const idx = alphabet.indexOf(clean[i])
    if (idx < 0) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function leftPad(num: string, len: number, ch = '0') {
  while (num.length < len) num = ch + num
  return num
}

export function totpGenerate(
  secretBase32: string,
  opts: { digits?: number; period?: number; algorithm?: 'sha1' | 'sha256' | 'sha512'; counterSeconds?: number } = {},
): string {
  const digits = opts.digits ?? 6
  const period = opts.period ?? 30
  const algRaw = (opts.algorithm ?? 'sha1').toLowerCase()
  const alg: 'sha1' | 'sha256' | 'sha512' =
    algRaw === 'sha256' ? 'sha256' : algRaw === 'sha512' ? 'sha512' : 'sha1'
  const counterSeconds = opts.counterSeconds ?? Math.floor(Date.now() / 1000)
  const counter = Math.floor(counterSeconds / period)
  const counterHex = leftPad(counter.toString(16), 16)
  const counterBuf = Buffer.from(counterHex, 'hex')
  const key = base32Decode(secretBase32)
  const hmac = createHmac(alg === 'sha256' ? 'sha256' : alg === 'sha512' ? 'sha512' : 'sha1', key)
  hmac.update(counterBuf)
  const hash = hmac.digest()
  const offset = hash[hash.length - 1] & 0x0f
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  return leftPad((code % Math.pow(10, digits)).toString(), digits)
}

export function totpVerify(
  code: string,
  secretBase32: string,
  opts: { digits?: number; period?: number; window?: number; algorithm?: 'sha1' | 'sha256' | 'sha512' } = {},
): boolean {
  const digits = opts.digits ?? 6
  const period = opts.period ?? 30
  const window = typeof opts.window === 'number' ? opts.window : 1
  const expected = (code || '').replace(/\s+/g, '')
  if (expected.length !== digits) return false
  const now = Math.floor(Date.now() / 1000)
  for (let w = -window; w <= window; w += 1) {
    const t = now + w * period
    const gen = totpGenerate(secretBase32, { digits, period, algorithm: opts.algorithm, counterSeconds: t })
    if (gen === expected) return true
  }
  return false
}
