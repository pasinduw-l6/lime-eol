-- CreateEnum
CREATE TYPE "ChangeReason" AS ENUM ('INITIAL_RECORD', 'PLANNED_UPGRADE', 'SECURITY_PATCH', 'ROLLBACK', 'DRIFT_CORRECTION', 'DECOMMISSION');

-- AlterTable: added nullable first so existing history can be carried across
-- rather than discarded.
ALTER TABLE "component_change"
  ADD COLUMN "corrects_id"   UUID,
  ADD COLUMN "evidence_url"  TEXT,
  ADD COLUMN "hash"          TEXT,
  ADD COLUMN "previous_hash" TEXT,
  ADD COLUMN "reason"        "ChangeReason" NOT NULL DEFAULT 'PLANNED_UPGRADE',
  ADD COLUMN "sequence"      INTEGER,
  ADD COLUMN "ticket_ref"    TEXT;

-- Backfill: number each environment's existing entries and link them into the
-- same hash chain new entries will extend. The payload below must stay in step
-- with canonicalPayload() in deployments.service.ts.
WITH RECURSIVE ordered AS (
  SELECT
    id,
    deployment_id,
    row_number() OVER (PARTITION BY deployment_id ORDER BY recorded_at, id) AS seq,
    deployment_id::text || '|' ||
      coalesce(from_version, '') || '|' ||
      coalesce(to_version, '')   || '|' ||
      change_type::text          || '|' ||
      to_char(effective_at, 'YYYY-MM-DD') AS payload
  FROM "component_change"
),
chain AS (
  SELECT
    o.id, o.deployment_id, o.seq, o.payload,
    NULL::text AS previous_hash,
    encode(sha256(o.payload::bytea), 'hex') AS hash
  FROM ordered o
  WHERE o.seq = 1

  UNION ALL

  SELECT
    o.id, o.deployment_id, o.seq, o.payload,
    c.hash AS previous_hash,
    encode(sha256((c.hash || o.payload)::bytea), 'hex') AS hash
  FROM ordered o
  JOIN chain c ON c.deployment_id = o.deployment_id AND o.seq = c.seq + 1
)
UPDATE "component_change" cc
   SET "sequence"      = ch.seq,
       "hash"          = ch.hash,
       "previous_hash" = ch.previous_hash
  FROM chain ch
 WHERE ch.id = cc.id;

-- Now they can be required.
ALTER TABLE "component_change"
  ALTER COLUMN "hash" SET NOT NULL,
  ALTER COLUMN "sequence" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "component_change_deployment_id_sequence_key" ON "component_change"("deployment_id", "sequence");

-- AddForeignKey
ALTER TABLE "component_change" ADD CONSTRAINT "component_change_corrects_id_fkey" FOREIGN KEY ("corrects_id") REFERENCES "component_change"("id") ON DELETE SET NULL ON UPDATE CASCADE;
