import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../../src/modules/auth/password.util';

const ENGINEERS: { email: string; displayName: string }[] = [
  { email: 'dinith@lime-automation.com', displayName: 'Dinith' },
  { email: 'kushantha@linearsix.com', displayName: 'Kushantha' },
  { email: 'pamodha@linearsix.com', displayName: 'Pamodha' },
  { email: 'pasinduw@linearsix.com', displayName: 'Pasindu W' },
  { email: 'randula@linearsix.com', displayName: 'Randula' },
  { email: 'suran@linearsix.com', displayName: 'Suran' },
];

const ENGINEER_PASSWORD = 'yl123';

// No viewer account is seeded. Signing in with Microsoft creates one for any
// address in the directory that is not listed above, so a standing shared
// account would be a second way in that nobody owns.
export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const engineerHash = await hashPassword(ENGINEER_PASSWORD);

  for (const engineer of ENGINEERS) {
    await prisma.appUser.upsert({
      where: { email: engineer.email },
      update: {
        displayName: engineer.displayName,
        passwordHash: engineerHash,
        role: Role.EDITOR,
        isActive: true,
      },
      create: {
        email: engineer.email,
        displayName: engineer.displayName,
        passwordHash: engineerHash,
        role: Role.EDITOR,
      },
    });
  }

  console.log(`  users: ${ENGINEERS.length} engineers (EDITOR)`);
}
