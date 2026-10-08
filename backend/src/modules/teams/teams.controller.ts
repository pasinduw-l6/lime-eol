import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Teams with their members and the environments they own' })
  findAll() {
    return this.teams.findAll();
  }

  @Get('archived')
  @ApiOperation({ summary: 'Archived teams' })
  archived() {
    return this.teams.findAll(true);
  }

  @Post()
  @Can('admin')
  @ApiOperation({ summary: 'Create a team' })
  create(@Body() body: CreateTeamDto) {
    return this.teams.create(body);
  }

  @Patch(':id')
  @Can('admin')
  @ApiOperation({ summary: 'Rename a team or replace its members' })
  update(@Param('id') id: string, @Body() body: UpdateTeamDto) {
    return this.teams.update(id, body);
  }

  @Delete(':id')
  @Can('admin')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive a team',
    description: 'Refused while the team still owns an environment.',
  })
  archive(@Param('id') id: string): Promise<void> {
    return this.teams.archive(id);
  }

  @Post(':id/restore')
  @Can('admin')
  @ApiOperation({ summary: 'Restore an archived team' })
  restore(@Param('id') id: string) {
    return this.teams.restore(id);
  }
}
