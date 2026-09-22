import { createHash } from 'node:crypto';

/**
 * Tamper evidence for the change log.
 *
 * Each entry hashes its own content together with the hash of the entry before
 * it, so the entries in one environment form a chain. Editing or deleting a
 * row in the database without going through the API breaks every hash after
 * it, and /history/verify reports exactly where.
 *
 * This does not prevent tampering — anyone with database access can rewrite
 * the chain wholesale. It makes quiet, single-row tampering detectable, which
 * is what an auditor actually asks for.
 */
export interface ChainPayload {
  deploymentId: string;
  fromVersion: string | null;
  toVersion: string | null;
  changeType: string;
  /** YYYY-MM-DD */
  effectiveAt: string;
}

/**
 * The exact string that gets hashed.
 *
 * Kept deliberately narrow and stable: the facts of the change, not its
 * annotations. A typo fixed in a note must not invalidate the chain, and the
 * backfill in migration 20260922130920 builds the same string in SQL.
 */
export function canonicalPayload(payload: ChainPayload): string {
  return [
    payload.deploymentId,
    payload.fromVersion ?? '',
    payload.toVersion ?? '',
    payload.changeType,
    payload.effectiveAt,
  ].join('|');
}

export function hashEntry(
  payload: ChainPayload,
  previousHash: string | null,
): string {
  return createHash('sha256')
    .update(`${previousHash ?? ''}${canonicalPayload(payload)}`)
    .digest('hex');
}

export interface ChainEntry extends ChainPayload {
  id: string;
  sequence: number;
  hash: string;
  previousHash: string | null;
}

export interface VerificationResult {
  intact: boolean;
  entries: number;
  /** Sequence numbers whose stored hash does not match a recomputation. */
  brokenAt: number[];
  checkedAt: string;
}

/** Recomputes the whole chain and reports where it stops matching. */
export function verifyChain(entries: ChainEntry[]): VerificationResult {
  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
  const brokenAt: number[] = [];
  let previousHash: string | null = null;

  for (const [index, entry] of ordered.entries()) {
    const expectedSequence = index + 1;
    const expectedHash = hashEntry(entry, previousHash);

    if (
      entry.sequence !== expectedSequence ||
      entry.previousHash !== previousHash ||
      entry.hash !== expectedHash
    ) {
      brokenAt.push(entry.sequence);
    }

    previousHash = entry.hash;
  }

  return {
    intact: brokenAt.length === 0,
    entries: ordered.length,
    brokenAt,
    checkedAt: new Date().toISOString(),
  };
}
