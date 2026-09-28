import { PrismaClient } from '@prisma/client';
import { seedUsers } from './users.seed';

const prisma = new PrismaClient();

seedUsers(prisma)
  .then(() => console.log('Accounts issued.'))
  .catch((error) => {
    console.error('Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
