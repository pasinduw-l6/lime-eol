import {
  randomBytes,
  scrypt,
  ScryptOptions,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

// Typed explicitly: promisify collapses scrypt's overloads onto the one without
// options, which is the variant that cannot set the cost parameters.
const scryptAsync = promisify<
  string,
  Buffer,
  number,
  ScryptOptions,
  Buffer
>(scrypt);

/**
 * Password hashing with scrypt.
 *
 * scrypt ships with Node and is memory-hard, so there is no native module to
 * build in the Alpine image and no chance of a plain digest creeping in. The
 * parameters are stored with the hash, which is what allows them to be raised
 * later without invalidating every existing password.
 */
const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelisation
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
  });

  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Whether a password matches a stored digest.
 *
 * Compared with timingSafeEqual rather than `===`: a byte-by-byte comparison
 * returns early at the first difference, and that timing difference is enough
 * to recover the hash a character at a time.
 */
export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) {
    return false;
  }

  const [scheme, costN, blockR, parallel, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64');

  try {
    const derived = await scryptAsync(
      password,
      Buffer.from(salt, 'base64'),
      expected.length,
      { N: Number(costN), r: Number(blockR), p: Number(parallel) },
    );

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
