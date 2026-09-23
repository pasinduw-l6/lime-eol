import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../../src/modules/auth/password.util';

/**
 * The people who may sign in.
 *
 * Accounts are issued here rather than through self-service registration: this
 * tool records who changed a customer's production estate, and an account that
 * anyone could create for themselves would make that record worthless.
 *
 * Passwords are the agreed starting ones and are meant to be changed. They are
 * hashed on the way in, so the database never holds the plain text even though
 * the starting values are written down elsewhere.
 */
const ENGINEERS: { email: string; displayName: string }[] = [
  { email: 'dinith@lime-automation.com', displayName: 'Dinith' },
  { email: 'kushantha@linearsix.com', displayName: 'Kushantha' },
  { email: 'pamodha@linearsix.com', displayName: 'Pamodha' },
  { email: 'pasinduw@linearsix.com', displayName: 'Pasindu W' },
  { email: 'randula@linearsix.com', displayName: 'Randula' },
  { email: 'suran@linearsix.com', displayName: 'Suran' },
];

const ENGINEER_PASSWORD = 'yl123';

/** A read-only account, for anyone who needs to look without recording. */
const VIEWER = {
  email: 'lime@linearsix.com',
  displayName: 'Lime Viewer',
  password: 'lime',
};

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const engineerHash = await hashPassword(ENGINEER_PASSWORD);

  for (const engineer of ENGINEERS) {
    // Upserted on email so a rerun re-issues the password without creating a
    // second account, and without disturbing the changes already attributed to
    // this person.
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

  const viewerHash = await hashPassword(VIEWER.password);

  await prisma.appUser.upsert({
    where: { email: VIEWER.email },
    update: {
      displayName: VIEWER.displayName,
      passwordHash: viewerHash,
      role: Role.VIEWER,
      isActive: true,
    },
    create: {
      email: VIEWER.email,
      displayName: VIEWER.displayName,
      passwordHash: viewerHash,
      role: Role.VIEWER,
    },
  });

  console.log(
    `  users: ${ENGINEERS.length} engineers (EDITOR), 1 viewer (VIEWER)`,
  );
}
