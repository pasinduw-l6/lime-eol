import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

const MS_PER_DAY = 86_400_000;

/**
 * The registry: technologies and their support cycles, including cycles
 * entered by hand for products endoflife.date no longer publishes.
 */
@ApiTags('registry')
@Controller('technologies')
export class TechnologiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Technologies with their cycles and versions' })
  @ApiOkResponse({ description: 'Technologies ordered by name' })
  async findAll() {
    const technologies = await this.prisma.technology.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        cycles: {
          orderBy: { eolDate: 'asc' },
          include: { versions: { orderBy: [{ major: 'desc' }, { minor: 'desc' }] } },
        },
      },
    });

    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

    return technologies.map((technology) => ({
      id: technology.id,
      name: technology.name,
      componentType: technology.componentType,
      vendor: technology.vendor,
      eolSlug: technology.eolSlug,
      cycleRule: technology.cycleRule,
      notes: technology.notes,
      cycles: technology.cycles.map((cycle) => ({
        id: cycle.id,
        cycle: cycle.cycle,
        label: cycle.label,
        releaseDate: cycle.releaseDate?.toISOString().slice(0, 10) ?? null,
        eolDate: cycle.eolDate?.toISOString().slice(0, 10) ?? null,
        activeSupportEnd:
          cycle.activeSupportEnd?.toISOString().slice(0, 10) ?? null,
        isLts: cycle.isLts,
        isMaintained: cycle.isMaintained,
        latestPatch: cycle.latestPatch,
        eolSource: cycle.eolSource,
        notes: cycle.notes,
        daysToEol: cycle.eolDate
          ? Math.round((cycle.eolDate.getTime() - todayUtc) / MS_PER_DAY)
          : null,
        versions: cycle.versions.map((v) => v.fullVersion),
      })),
    }));
  }
}
