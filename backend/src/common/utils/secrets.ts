import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getEnv } from '../../config/env.validation';

const ALGORITHM = 'aes-256-gcm';

function key(): Buffer {
  const env = getEnv();
  return createHash('sha256')
    .update(env.SECRETS_KEY ?? `lime-integrations:${env.SESSION_SECRET}`)
    .digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function open(sealed: string): string {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) {
    throw new Error('That stored credential is in an unknown format.');
  }
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

export function hint(plain: string): string {
  const tail = plain.trim().slice(-4);
  return tail ? `••••${tail}` : '••••';
}
