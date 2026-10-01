import { PrismaClient } from '@prisma/client';
import { seedNotificationRules } from './notification-rules.seed';
import { seedTechnologies } from './technologies.seed';
import { seedUsers } from './users.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding:');

  await seedUsers(prisma);
  await seedNotificationRules(prisma);
  await seedTechnologies(prisma);

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
