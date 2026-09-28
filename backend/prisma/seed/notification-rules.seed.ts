import { PrismaClient } from '@prisma/client';

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
