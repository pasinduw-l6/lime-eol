import { Environment, PrismaClient } from '@prisma/client';

const STACK = [
  { technology: 'Red Hat Enterprise Linux', version: '7.4' },
  { technology: 'Docker Engine', version: '18.09.4' },
  { technology: 'Kubernetes', version: '1.14.1' },
  { technology: 'MongoDB', version: '8.0' },
];

const ENVIRONMENTS: {
  environment: Environment;
  location: 'EC2' | 'CUSTOMER_SITE';
  detail: string;
}[] = [
  { environment: 'PROD', location: 'CUSTOMER_SITE', detail: 'Siyapatha DC' },
  { environment: 'UAT', location: 'CUSTOMER_SITE', detail: 'Siyapatha DC' },
  { environment: 'DEV', location: 'EC2', detail: 'ap-south-1' },
];

export async function seedSampleData(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.appUser.upsert({
    where: { email: 'admin@linearsix.com' },
    update: {},
    create: {
      email: 'admin@linearsix.com',
      displayName: 'Platform Admin',
      role: 'ADMIN',
    },
  });

  const engineer = await prisma.appUser.upsert({
    where: { email: 'devops@linearsix.com' },
    update: {},
    create: {
      email: 'devops@linearsix.com',
      displayName: 'DevOps Engineer',
      role: 'EDITOR',
    },
  });

  const devops = await prisma.team.upsert({
    where: { name: 'DevOps' },
    update: {},
    create: { name: 'DevOps', email: 'devops@linearsix.com' },
  });

  for (const userId of [admin.id, engineer.id]) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: devops.id, userId } },
      update: {},
      create: { teamId: devops.id, userId },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { name: 'Siyapatha' },
    update: {},
    create: { name: 'Siyapatha', code: 'SYP' },
  });

  const project = await prisma.project.upsert({
    where: { code: 'SYP' },
    update: {},
    create: {
      customerId: customer.id,
      name: 'Siyapatha',
      code: 'SYP',
      status: 'ACTIVE',
      startedAt: new Date('2023-01-01T00:00:00.000Z'),
    },
  });

  for (const [userId, isLead] of [
    [admin.id, true],
    [engineer.id, false],
  ] as const) {
    await prisma.projectEngineer.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: { projectId: project.id, userId, isLead },
    });
  }

  const versions = await prisma.technologyVersion.findMany({
    where: {
      OR: STACK.map((s) => ({
        fullVersion: s.version,
        cycle: { technology: { name: s.technology } },
      })),
    },
    include: { cycle: { include: { technology: true } } },
  });

  if (versions.length !== STACK.length) {
    throw new Error(
      `Seed error: expected ${STACK.length} versions for Siyapatha, found ${versions.length}`,
    );
  }

  for (const env of ENVIRONMENTS) {
    const deployment = await prisma.deployment.upsert({
      where: {
        projectId_environment: {
          projectId: project.id,
          environment: env.environment,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        customerId: customer.id,
        name: `Siyapatha ${env.environment}`,
        environment: env.environment,
        location: env.location,
        locationDetail: env.detail,
      },
    });

    await prisma.deploymentOwner.upsert({
      where: {
        deploymentId_teamId: { deploymentId: deployment.id, teamId: devops.id },
      },
      update: {},
      create: { deploymentId: deployment.id, teamId: devops.id, isPrimary: true },
    });

    for (const version of versions) {
      await prisma.deploymentComponent.upsert({
        where: {
          deploymentId_techVersionId: {
            deploymentId: deployment.id,
            techVersionId: version.id,
          },
        },
        update: {},
        create: { deploymentId: deployment.id, techVersionId: version.id },
      });
    }
  }

  console.log(
    `  project Siyapatha: ${ENVIRONMENTS.length} environments × ${versions.length} components, 2 engineers`,
  );
}
