import { PrismaClient } from '@prisma/client';
import { seedNotificationRules } from './notification-rules.seed';
import { seedSampleData } from './sample-data.seed';
import { seedTechnologies } from './technologies.seed';

/**
 * Seeds reference data and a small sample estate.
 *
 * Every step upserts, so running it twice changes nothing and it is safe
 * against a database that already holds real data.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding:');

  await seedNotificationRules(prisma);
  await seedTechnologies(prisma);
  await seedSampleData(prisma);

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
