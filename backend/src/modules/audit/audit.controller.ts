import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('audit')
@Controller('audit')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Who changed what, newest first' })
  @ApiQuery({ name: 'entity', required: false, example: 'projects' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  async list(
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      entity: entity || undefined,
      userId: userId || undefined,
      createdAt: {
        gte: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      },
    };
    const take = Math.min(500, Math.max(1, Number(limit) || 100));
    const skip = Math.max(0, Number(offset) || 0);

    const [total, rows, entities] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { user: true },
      }),
      this.prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true } }),
    ]);

    return {
      total,
      entities: entities.map((e) => e.entity).sort(),
      rows: rows.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        user: row.user ? { id: row.user.id, name: row.user.displayName ?? row.user.email } : null,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        data: row.afterData,
      })),
    };
  }
}
