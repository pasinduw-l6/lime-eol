-- Announcements that are not end-of-life thresholds: Jira transitions, overdue
-- plans, the weekly digest. notification_log stays as it is - it is keyed on a
-- cycle and a threshold in days, which none of these have.
CREATE TABLE "notification_event" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "dedup_key" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_event_dedup_key_key" ON "notification_event"("dedup_key");

CREATE INDEX "notification_event_kind_sent_at_idx" ON "notification_event"("kind", "sent_at");
