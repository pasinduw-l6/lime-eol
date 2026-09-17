import { PrismaClient } from '@prisma/client';

/**
 * A small but realistic estate: two teams, two customers, one Lime release and
 * four deployments — enough to exercise impact analysis, the override rule and
 * the dashboard before any real data exists.
 */
export async function seedSampleData(prisma: PrismaClient): Promise<void> {
  // ---- People and teams ----
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

  const platform = await prisma.team.upsert({
    where: { name: 'Platform' },
    update: {},
    create: { name: 'Platform', email: 'platform@linearsix.com' },
  });

  for (const [teamId, userId] of [
    [devops.id, admin.id],
    [devops.id, engineer.id],
    [platform.id, admin.id],
  ]) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId } },
      update: {},
      create: { teamId, userId },
    });
  }

  // ---- Lime release and its component set ----
  const limeVersion = await prisma.limeVersion.upsert({
    where: { versionNumber: '2026.1' },
    update: {},
    create: {
      versionNumber: '2026.1',
      releaseDate: new Date('2026-03-01T00:00:00.000Z'),
      notes: 'Current shipping release',
    },
  });

  const defaultComponents = await prisma.technologyVersion.findMany({
    where: {
      fullVersion: {
        in: ['8.2.12', '24.21.0', '20.3.31', '1.35.8', '9.8', '3.8.1', '3.6.4'],
      },
    },
  });

  for (const component of defaultComponents) {
    await prisma.limeVersionComponent.upsert({
      where: {
        limeVersionId_techVersionId: {
          limeVersionId: limeVersion.id,
          techVersionId: component.id,
        },
      },
      update: {},
      create: { limeVersionId: limeVersion.id, techVersionId: component.id },
    });
  }

  // ---- Customers and their environments ----
  const acme = await prisma.customer.upsert({
    where: { name: 'Acme Bank' },
    update: {},
    create: { name: 'Acme Bank', code: 'ACME', contact: 'ops@acme.example' },
  });

  const northwind = await prisma.customer.upsert({
    where: { name: 'Northwind Insurance' },
    update: {},
    create: {
      name: 'Northwind Insurance',
      code: 'NWND',
      contact: 'it@northwind.example',
    },
  });

  const deployments = [
    {
      customerId: acme.id,
      name: 'Acme Production',
      environment: 'PROD' as const,
      location: 'EC2' as const,
      locationDetail: 'eu-west-1',
      owners: [
        { teamId: devops.id, isPrimary: true },
        // Two owners: the reason DeploymentOwner exists rather than a single
        // team_id — both teams must hear about an EOL.
        { teamId: platform.id, isPrimary: false },
      ],
    },
    {
      customerId: acme.id,
      name: 'Acme UAT',
      environment: 'UAT' as const,
      location: 'EC2' as const,
      locationDetail: 'eu-west-1',
      owners: [{ teamId: devops.id, isPrimary: true }],
    },
    {
      customerId: northwind.id,
      name: 'Northwind Production',
      environment: 'PROD' as const,
      location: 'CUSTOMER_SITE' as const,
      locationDetail: 'Northwind DC, Colombo',
      owners: [{ teamId: platform.id, isPrimary: true }],
    },
    {
      customerId: northwind.id,
      name: 'Northwind DEV',
      environment: 'DEV' as const,
      location: 'CUSTOMER_SITE' as const,
      locationDetail: 'Northwind DC, Colombo',
      owners: [{ teamId: platform.id, isPrimary: true }],
    },
  ];

  const created: Record<string, string> = {};

  for (const d of deployments) {
    const deployment = await prisma.deployment.upsert({
      where: {
        customerId_name_environment: {
          customerId: d.customerId,
          name: d.name,
          environment: d.environment,
        },
      },
      update: {},
      create: {
        customerId: d.customerId,
        limeVersionId: limeVersion.id,
        name: d.name,
        environment: d.environment,
        location: d.location,
        locationDetail: d.locationDetail,
      },
    });
    created[d.name] = deployment.id;

    for (const owner of d.owners) {
      await prisma.deploymentOwner.upsert({
        where: {
          deploymentId_teamId: {
            deploymentId: deployment.id,
            teamId: owner.teamId,
          },
        },
        update: {},
        create: {
          deploymentId: deployment.id,
          teamId: owner.teamId,
          isPrimary: owner.isPrimary,
        },
      });
    }
  }

  // ---- An override: Northwind already moved MongoDB off the Lime default ----
  // This is the case v_deployment_effective_component resolves: MongoDB 8.3.11
  // must replace the Lime default of 8.2.12, not appear alongside it.
  const mongo83 = await prisma.technologyVersion.findFirst({
    where: { fullVersion: '8.3.11' },
  });

  if (mongo83) {
    await prisma.deploymentComponent.upsert({
      where: {
        deploymentId_techVersionId: {
          deploymentId: created['Northwind Production'],
          techVersionId: mongo83.id,
        },
      },
      update: {},
      create: {
        deploymentId: created['Northwind Production'],
        techVersionId: mongo83.id,
      },
    });
  }

  // ---- An upgrade action for the worst offender ----
  const kafka = await prisma.technologyCycle.findFirst({
    where: { cycle: '3.8', technology: { name: 'Apache Kafka' } },
  });

  if (kafka) {
    const existing = await prisma.upgradeAction.findFirst({
      where: { technologyCycleId: kafka.id },
    });

    if (!existing) {
      await prisma.upgradeAction.create({
        data: {
          technologyCycleId: kafka.id,
          teamId: devops.id,
          assigneeId: engineer.id,
          targetVersion: '4.1',
          plannedDate: new Date('2026-10-15T00:00:00.000Z'),
          status: 'PLANNED',
          jiraKey: 'LIME-1042',
          customerComm: 'PENDING',
          remarks: 'Kafka 3.8 reached end of life in November 2024.',
          deployments: {
            create: [
              { deploymentId: created['Acme Production'] },
              { deploymentId: created['Northwind Production'] },
            ],
          },
        },
      });
    }
  }

  console.log(
    `  users: 2, teams: 2, customers: 2, deployments: ${deployments.length}, ` +
      `lime version 2026.1 with ${defaultComponents.length} components, 1 upgrade action`,
  );
}
