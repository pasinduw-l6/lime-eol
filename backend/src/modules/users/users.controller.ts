import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The people who can be staffed on a project.
 *
 * Separate from the project payload on purpose: the engineer picker needs
 * everyone who *could* be assigned, and reading them off the projects only ever
 * returns the people already assigned — a closed loop that makes it impossible
 * to add anyone new.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Active accounts, with how many projects each is staffed on',
  })
  @ApiOkResponse({ description: 'Users ordered by name' })
  async findAll() {
    const users = await this.prisma.appUser.findMany({
      // Deactivated accounts keep their rows so history stays attributed to
      // them, but they are not offered for new work.
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
      include: { _count: { select: { projects: true } } },
    });

    return users.map((user) => {
      const displayName = user.displayName ?? user.email;

      return {
        id: user.id,
        email: user.email,
        name: displayName,
        initials: initialsOf(displayName),
        role: user.role,
        /** Whether they can record changes, or only look. */
        canEdit: user.role !== 'VIEWER',
        projectCount: user._count.projects,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      };
    });
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
