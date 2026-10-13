import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { Can } from '../auth/can.decorator';

const LEVELS = ['VIEW', 'EDIT'] as const;

class AccessChange {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Leave out to change the all-projects level' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ enum: LEVELS, nullable: true, description: 'null removes the access' })
  @ValidateIf((_, v) => v !== null)
  @IsIn(LEVELS)
  level!: (typeof LEVELS)[number] | null;
}

class AccessBatch {
  @ApiProperty({ type: [AccessChange] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => AccessChange)
  changes!: AccessChange[];
}

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Can('admin')
  @ApiOperation({ summary: 'Who can see or edit each project' })
  async matrix() {
    const [projects, users] = await Promise.all([
      this.prisma.project.findMany({
        where: { archivedAt: null },
        orderBy: [{ customer: { name: 'asc' } }, { name: 'asc' }],
        select: { id: true, name: true, code: true, customer: { select: { id: true, name: true } } },
      }),
      this.prisma.appUser.findMany({
        orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }, { email: 'asc' }],
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          allProjects: true,
          projectAccess: { select: { projectId: true, level: true } },
          projects: { select: { projectId: true, isLead: true } },
        },
      }),
    ]);

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        customerId: p.customer.id,
        customer: p.customer.name,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.displayName ?? u.email,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        allProjects: u.allProjects,
        access: Object.fromEntries(u.projectAccess.map((a) => [a.projectId, a.level])),
        staffed: Object.fromEntries(u.projects.map((p) => [p.projectId, p.isLead ? 'lead' : 'engineer'])),
      })),
    };
  }

  @Put()
  @Can('admin')
  @ApiOperation({ summary: 'Save a batch of access changes from the grid' })
  async save(@Body() body: AccessBatch) {
    await this.prisma.$transaction(
      body.changes.map((change) =>
        change.projectId
          ? change.level
            ? this.prisma.projectAccess.upsert({
                where: { userId_projectId: { userId: change.userId, projectId: change.projectId } },
                update: { level: change.level },
                create: { userId: change.userId, projectId: change.projectId, level: change.level },
              })
            : this.prisma.projectAccess.deleteMany({
                where: { userId: change.userId, projectId: change.projectId },
              })
          : this.prisma.appUser.update({
              where: { id: change.userId },
              data: { allProjects: change.level },
            }),
      ),
    );
    return this.matrix();
  }
}
