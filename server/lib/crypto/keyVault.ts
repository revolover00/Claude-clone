import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterSecret(): Buffer {
  const secretBase64 = process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (!secretBase64) {
    throw new Error('PROVIDER_KEY_ENCRYPTION_SECRET is missing');
  }
  const secret = Buffer.from(secretBase64, 'base64');
  if (secret.length !== KEY_LENGTH) {
    throw new Error('PROVIDER_KEY_ENCRYPTION_SECRET must be 32 bytes');
  }
  return secret;
}

export function encrypt(text: string): { ciphertext: string; iv: string; tag: string } {
  const secret = getMasterSecret();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(ciphertext: string, iv: string, tag: string): string {
  const secret = getMasterSecret();
  const decipher = crypto.createDecipheriv(ALGORITHM, secret, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
