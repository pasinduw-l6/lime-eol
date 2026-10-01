import { PrismaClient, Role } from '@prisma/client';

const ENGINEERS: { email: string; displayName: string }[] = [
  { email: 'dinith@lime-automation.com', displayName: 'Dinith' },
  { email: 'kushantha@linearsix.com', displayName: 'Kushantha' },
  { email: 'pamodha@linearsix.com', displayName: 'Pamodha' },
  { email: 'pasinduw@linearsix.com', displayName: 'Pasindu W' },
  { email: 'randula@linearsix.com', displayName: 'Randula' },
  { email: 'suran@linearsix.com', displayName: 'Suran' },
];

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  for (const engineer of ENGINEERS) {
    await prisma.appUser.upsert({
      where: { email: engineer.email },
      update: {
        displayName: engineer.displayName,
        role: Role.EDITOR,
        isActive: true,
      },
      create: {
        email: engineer.email,
        displayName: engineer.displayName,
        role: Role.EDITOR,
      },
    });
  }

  console.log(`  users: ${ENGINEERS.length} engineers (EDITOR)`);
}
