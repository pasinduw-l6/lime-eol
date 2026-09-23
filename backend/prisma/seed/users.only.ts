import { PrismaClient } from '@prisma/client';
import { seedUsers } from './users.seed';

/**
 * Issues accounts without touching anything else.
 *
 * The full seed also writes sample estate data, which must not run against a
 * database holding a real customer's environments.
 */
const prisma = new PrismaClient();

seedUsers(prisma)
  .then(() => console.log('Accounts issued.'))
  .catch((error) => {
    console.error('Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
