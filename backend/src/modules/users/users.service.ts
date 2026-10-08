import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';

const INCLUDE = {
  _count: { select: { projects: true } },
  teams: { include: { team: true } },
} satisfies Prisma.AppUserInclude;

type UserRow = Prisma.AppUserGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean) {
    const users = await this.prisma.appUser.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }, { email: 'asc' }],
      include: INCLUDE,
    });
    return users.map((user) => this.toDto(user));
  }

  async invite(input: InviteUserDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.appUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(
        existing.isActive
          ? `${email} already has an account.`
          : `${email} has a deactivated account. Reactivate it instead.`,
      );
    }

    const user = await this.prisma.appUser.create({
      data: {
        email,
        displayName: input.displayName?.trim() || null,
        role: input.role as Role,
      },
      include: INCLUDE,
    });
    return this.toDto(user);
  }

  async update(id: string, input: UpdateUserDto, actorId: string) {
    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`No user "${id}"`);
    }

    const losesAdmin =
      user.role === Role.ADMIN &&
      user.isActive &&
      ((input.role !== undefined && input.role !== 'ADMIN') || input.isActive === false);

    if (losesAdmin) {
      const admins = await this.prisma.appUser.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (admins <= 1) {
        throw new BadRequestException('There must always be at least one active admin.');
      }
    }

    if (id === actorId && input.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const updated = await this.prisma.appUser.update({
      where: { id },
      data: {
        displayName: input.displayName?.trim(),
        role: input.role as Role | undefined,
        isActive: input.isActive,
      },
      include: INCLUDE,
    });
    return this.toDto(updated);
  }

  private toDto(user: UserRow) {
    const displayName = user.displayName ?? user.email;
    return {
      id: user.id,
      email: user.email,
      name: displayName,
      initials: initialsOf(displayName),
      role: user.role,
      isActive: user.isActive,
      canEdit: user.role !== Role.VIEWER,
      projectCount: user._count.projects,
      teams: user.teams.map((link) => ({ id: link.team.id, name: link.team.name })),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }
}

function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
