import crypto from 'crypto';

/**
 * Advanced encryption utility using AES-256-GCM for production-ready security.
 * GCM provides both confidentiality and authenticity.
 */

const ENCRYPTION_SECRET = (process.env.ENCRYPTION_SECRET || "").trim();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

export function encrypt(text: string): string {
  if (!ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET is not defined');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  // Ensure the key is exactly 32 bytes for aes-256
  const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_SECRET) {
    throw new Error('ENCRYPTION_SECRET is not defined');
  }

  const [ivHex, authTagHex, encryptedText] = text.split(':');
  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
