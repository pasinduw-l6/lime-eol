import { PrismaClient } from '@prisma/client';

/** Notify 180, 90 and 30 days before end of life, and on the day itself. */
const THRESHOLDS = [180, 90, 30, 0];

export async function seedNotificationRules(prisma: PrismaClient): Promise<void> {
  for (const thresholdDays of THRESHOLDS) {
    await prisma.notificationRule.upsert({
      where: { thresholdDays },
      update: {},
      create: { thresholdDays },
    });
  }

  console.log(`  notification rules: ${THRESHOLDS.join(', ')} days`);
}
