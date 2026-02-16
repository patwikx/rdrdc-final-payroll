import crypto from "node:crypto"

const ENCRYPTED_PREFIX = "enc:v1:"
const PLAIN_PREFIX = "plain:"

const getSecret = (): string => {
  return (
    process.env.BIOMETRIC_CREDENTIAL_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    ""
  )
}

const getKey = (): Buffer | null => {
  const secret = getSecret()
  if (!secret) return null
  return crypto.createHash("sha256").update(secret, "utf8").digest()
}

export const encryptBiometricCredential = (value: string | undefined): string | null => {
  const plain = value?.trim()
  if (!plain) return null

  const key = getKey()
  if (!key) {
    return `${PLAIN_PREFIX}${plain}`
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export const decryptBiometricCredential = (value: string | null | undefined): string | null => {
  if (!value) return null

  if (value.startsWith(PLAIN_PREFIX)) {
    return value.slice(PLAIN_PREFIX.length)
  }

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const [ivBase64, tagBase64, dataBase64] = payload.split(":")
  if (!ivBase64 || !tagBase64 || !dataBase64) {
    return null
  }

  const key = getKey()
  if (!key) {
    return null
  }

  try {
    const iv = Buffer.from(ivBase64, "base64")
    const tag = Buffer.from(tagBase64, "base64")
    const encrypted = Buffer.from(dataBase64, "base64")

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return plain.toString("utf8")
  } catch {
    return null
  }
}
