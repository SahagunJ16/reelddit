import crypto from "crypto";

/**
 * AES-256-GCM encryption for Reddit tokens at rest.
 *
 * Output format: base64( iv(12) | authTag(16) | ciphertext )
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — cannot encrypt/decrypt Reddit tokens."
    );
  }
  // Accept base64, hex, or raw utf8 and normalize to 32 bytes via SHA-256.
  let key: Buffer;
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 44) {
    key = Buffer.from(raw, "base64");
  } else if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "utf8");
  }
  if (key.length !== 32) {
    key = crypto.createHash("sha256").update(key).digest();
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
