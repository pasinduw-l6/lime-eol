import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';

type User = {
  role: string;
  allProjects: 'VIEW' | 'EDIT' | null;
  projectAccess: { projectId: string; level: 'VIEW' | 'EDIT' }[];
  projects: { projectId: string }[];
};

function service(user: User, actionProjects: string[] = ['p1']) {
  const prisma = {
    appUser: { findUnique: jest.fn().mockResolvedValue(user) },
    project: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => Promise.resolve({ id: where.id })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    upgradeAction: {
      findUnique: jest.fn().mockResolvedValue({
        deployments: actionProjects.map((projectId) => ({ deployment: { projectId } })),
      }),
    },
    customer: {
      findUnique: jest.fn().mockResolvedValue({ projects: [{ id: 'p1' }, { id: 'p2' }] }),
    },
  };
  return new AccessService(prisma as never);
}

const base: User = { role: 'SRE', allProjects: null, projectAccess: [], projects: [] };

describe('AccessService', () => {
  it('lets an admin do anything', async () => {
    await expect(service({ ...base, role: 'ADMIN' }).check('u', 'project', 'p9', 'EDIT')).resolves.toBeUndefined();
  });

  it('hides a project the person has no access to', async () => {
    await expect(service(base).check('u', 'project', 'p1', 'VIEW')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows reading but not changing with view access', async () => {
    const s = service({ ...base, projectAccess: [{ projectId: 'p1', level: 'VIEW' }] });
    await expect(s.check('u', 'project', 'p1', 'VIEW')).resolves.toBeUndefined();
    await expect(s.check('u', 'project', 'p1', 'EDIT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gives assigned engineers edit access', async () => {
    const s = service({ ...base, projects: [{ projectId: 'p1' }] });
    await expect(s.check('u', 'project', 'p1', 'EDIT')).resolves.toBeUndefined();
  });

  it('uses the higher of all-projects and a single grant', async () => {
    const s = service({ ...base, allProjects: 'VIEW', projectAccess: [{ projectId: 'p1', level: 'EDIT' }] });
    await expect(s.check('u', 'project', 'p1', 'EDIT')).resolves.toBeUndefined();
    await expect(s.check('u', 'project', 'p2', 'EDIT')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(s.check('u', 'project', 'p2', 'VIEW')).resolves.toBeUndefined();
  });

  it('needs edit on every project a plan touches to change it', async () => {
    const s = service({ ...base, projectAccess: [{ projectId: 'p1', level: 'EDIT' }, { projectId: 'p2', level: 'VIEW' }] }, ['p1', 'p2']);
    await expect(s.check('u', 'action', 'a1', 'VIEW')).resolves.toBeUndefined();
    await expect(s.check('u', 'action', 'a1', 'EDIT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a customer be edited with edit on any of its projects', async () => {
    const s = service({ ...base, projectAccess: [{ projectId: 'p2', level: 'EDIT' }] });
    await expect(s.check('u', 'customer', 'c1', 'EDIT')).resolves.toBeUndefined();
  });

  it('keeps creating new projects or customers to all-projects editors', async () => {
    await expect(service({ ...base, projectAccess: [{ projectId: 'p1', level: 'EDIT' }] }).check('u', 'global', undefined, 'EDIT')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service({ ...base, allProjects: 'VIEW' }).check('u', 'global', undefined, 'EDIT')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service({ ...base, allProjects: 'EDIT' }).check('u', 'global', undefined, 'EDIT')).resolves.toBeUndefined();
  });

  it('lists only visible projects unless the person sees everything', async () => {
    expect(await service({ ...base, allProjects: 'VIEW' }).visibleProjectIds('u')).toBeNull();
    expect(await service({ ...base, projectAccess: [{ projectId: 'p1', level: 'VIEW' }], projects: [{ projectId: 'p3' }] }).visibleProjectIds('u')).toEqual(['p1', 'p3']);
  });
});
