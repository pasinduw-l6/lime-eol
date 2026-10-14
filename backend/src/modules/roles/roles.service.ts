import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cleanPages, cleanPermissions, GRANTABLE, PAGES } from '../auth/permissions';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  catalogue() {
    return { permissions: GRANTABLE, pages: PAGES };
  }

  async findAll() {
    const roles = await this.prisma.appRole.findMany({
      orderBy: [{ builtIn: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: { where: { isActive: true } } } } },
    });
    return roles.map((role) => toDto(role, role._count.users));
  }

  async create(input: CreateRoleDto) {
    const name = input.name.trim();
    const key = keyFor(name);
    if (!key) throw new BadRequestException('Give the role a name with letters or digits.');
    if (await this.prisma.appRole.findFirst({ where: { OR: [{ key }, { name: { equals: name, mode: 'insensitive' } }] } })) {
      throw new ConflictException(`A role called ${name} already exists.`);
    }

    const role = await this.prisma.appRole.create({
      data: {
        key,
        name,
        description: input.description?.trim() || null,
        permissions: cleanPermissions(input.permissions),
        pages: cleanPages(input.pages),
      },
    });
    return toDto(role, 0);
  }

  async update(key: string, input: UpdateRoleDto) {
    const role = await this.mustExist(key);
    if (role.key === 'ADMIN') {
      throw new BadRequestException('The Admin role always has full access and cannot be changed.');
    }

    const name = input.name?.trim();
    if (name && name.toLowerCase() !== role.name.toLowerCase()) {
      const clash = await this.prisma.appRole.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
      if (clash) throw new ConflictException(`A role called ${name} already exists.`);
    }

    try {
      const updated = await this.prisma.appRole.update({
        where: { key },
        data: {
          name,
          description: input.description === undefined ? undefined : input.description?.trim() || null,
          permissions: input.permissions === undefined ? undefined : cleanPermissions(input.permissions),
          pages: input.pages === undefined ? undefined : cleanPages(input.pages),
        },
        include: { _count: { select: { users: { where: { isActive: true } } } } },
      });
      return toDto(updated, updated._count.users);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A role with that name already exists.');
      }
      throw error;
    }
  }

  async remove(key: string, moveTo?: string): Promise<void> {
    const role = await this.mustExist(key);
    if (role.builtIn) {
      throw new BadRequestException(`${role.name} is built in and cannot be deleted.`);
    }

    const users = await this.prisma.appUser.count({ where: { role: key } });
    if (users > 0) {
      if (!moveTo) {
        throw new BadRequestException(`${users} ${users === 1 ? 'person has' : 'people have'} this role. Choose a role to move them to.`);
      }
      if (moveTo === key) throw new BadRequestException('Choose a different role to move people to.');
      await this.mustExist(moveTo);
    }

    await this.prisma.$transaction([
      ...(users > 0 ? [this.prisma.appUser.updateMany({ where: { role: key }, data: { role: moveTo! } })] : []),
      this.prisma.appRole.delete({ where: { key } }),
    ]);
  }

  private async mustExist(key: string): Promise<AppRole> {
    const role = await this.prisma.appRole.findUnique({ where: { key } });
    if (!role) throw new NotFoundException(`No role "${key}".`);
    return role;
  }
}

export function keyFor(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function toDto(role: AppRole, users: number) {
  return {
    key: role.key,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    pages: role.pages,
    builtIn: role.builtIn,
    editable: role.key !== 'ADMIN',
    users,
  };
}
