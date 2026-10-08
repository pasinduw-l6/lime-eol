import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

const INCLUDE = {
  members: { include: { user: true } },
  ownedDeployments: { where: { deployment: { archivedAt: null } }, include: { deployment: true } },
} satisfies Prisma.TeamInclude;

type TeamRow = Prisma.TeamGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(archived = false) {
    const teams = await this.prisma.team.findMany({
      where: { archivedAt: archived ? { not: null } : null },
      orderBy: { name: 'asc' },
      include: INCLUDE,
    });
    return teams.map((team) => this.toDto(team));
  }

  async create(input: CreateTeamDto) {
    const name = input.name.trim();
    await this.assertNameFree(name);
    await this.assertMembersActive(input.memberIds ?? []);

    const team = await this.prisma.team.create({
      data: {
        name,
        email: input.email?.trim() || null,
        members: { create: (input.memberIds ?? []).map((userId) => ({ userId })) },
      },
      include: INCLUDE,
    });
    return this.toDto(team);
  }

  async update(id: string, input: UpdateTeamDto) {
    const team = await this.require(id);
    const name = input.name?.trim();
    if (name && name !== team.name) await this.assertNameFree(name);

    if (input.memberIds) {
      await this.assertMembersActive(input.memberIds);
      await this.prisma.$transaction([
        this.prisma.teamMember.deleteMany({ where: { teamId: id } }),
        this.prisma.teamMember.createMany({
          data: [...new Set(input.memberIds)].map((userId) => ({ teamId: id, userId })),
        }),
      ]);
    }

    const updated = await this.prisma.team.update({
      where: { id },
      data: {
        name,
        email: input.email === undefined ? undefined : input.email?.trim() || null,
      },
      include: INCLUDE,
    });
    return this.toDto(updated);
  }

  async archive(id: string): Promise<void> {
    const team = await this.prisma.team.findFirst({ where: { id, archivedAt: null }, include: INCLUDE });
    if (!team) throw new NotFoundException(`No team "${id}"`);

    if (team.ownedDeployments.length > 0) {
      throw new ConflictException(
        `${team.name} still owns ${team.ownedDeployments.map((o) => o.deployment.name).join(', ')}. Give them a new owner first.`,
      );
    }
    await this.prisma.team.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  async restore(id: string) {
    const team = await this.prisma.team.findFirst({ where: { id, archivedAt: { not: null } } });
    if (!team) throw new NotFoundException(`No archived team "${id}"`);
    const restored = await this.prisma.team.update({
      where: { id },
      data: { archivedAt: null },
      include: INCLUDE,
    });
    return this.toDto(restored);
  }

  private async require(id: string) {
    const team = await this.prisma.team.findFirst({ where: { id, archivedAt: null } });
    if (!team) throw new NotFoundException(`No team "${id}"`);
    return team;
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.prisma.team.findUnique({ where: { name } })) {
      throw new ConflictException(`A team called ${name} already exists.`);
    }
  }

  private async assertMembersActive(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await this.prisma.appUser.count({ where: { id: { in: unique }, isActive: true } });
    if (found !== unique.length) {
      throw new BadRequestException('Every member must be an active account.');
    }
  }

  private toDto(team: TeamRow) {
    return {
      id: team.id,
      name: team.name,
      email: team.email,
      archivedAt: team.archivedAt?.toISOString() ?? null,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.displayName ?? m.user.email,
      })),
      environments: team.ownedDeployments.map((o) => ({
        id: o.deployment.id,
        name: o.deployment.name,
        isPrimary: o.isPrimary,
      })),
    };
  }
}
