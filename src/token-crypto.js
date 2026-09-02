import crypto from 'node:crypto';

const keyFor = (secret) => {
  const value = String(secret || '');
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 32 && value.length >= 43) return decoded;
  if (value.length < 32) throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  return crypto.createHash('sha256').update(value).digest();
};

export function encryptSecret(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value, secret) {
  const [version, iv, tag, encrypted] = String(value || '').split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid encrypted token format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

