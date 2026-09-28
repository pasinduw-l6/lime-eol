import { createHash } from 'node:crypto';

export interface ChainPayload {
  deploymentId: string;
  fromVersion: string | null;
  toVersion: string | null;
  changeType: string;
  effectiveAt: string;
}

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
  brokenAt: number[];
  checkedAt: string;
}

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
