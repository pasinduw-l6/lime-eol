import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

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
