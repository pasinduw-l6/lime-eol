import { AccessService } from '../access/access.service';
import { Scope } from '../access/scope.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddEnvironmentDto } from './dto/add-environment.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetEngineersDto } from './dto/set-engineers.dto';
import { ProjectDto } from './dto/project-response.dto';
import { ProjectsService } from './projects.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../auth/current-user.decorator';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Every project with its environments and their components',
    description:
      'One call per screen: each environment carries its components with lifecycle state already resolved, so the client never fans out per row.',
  })
  @ApiOkResponse({ type: [ProjectDto] })
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<ProjectDto[]> {
    const [scope, list] = await Promise.all([this.access.scope(user.id), this.projects.findAll()]);
    return list
      .map((project) => ({ ...project, access: this.access.levelIn(scope, project.id) }))
      .filter((project) => project.access !== null);
  }

  @Post()
  @Scope('global')
  @ApiOperation({
    summary: 'Create a project with its environments and their stack',
    description:
      'Each component is recorded as an INSTALL in the change history, so a new project starts with a complete record rather than appearing fully formed.',
  })
  @ApiCreatedResponse({ type: ProjectDto })
  create(
    @Body() body: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projects.create(body, user.id);
  }

  @Patch(':id')
  @Scope('project')
  @ApiOperation({
    summary: 'Change the details of a project',
    description:
      'The code is not editable: it is the natural key, quoted in Jira issues and used by the importer, so changing it would break those links.',
  })
  update(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projects.update(id, body);
  }

  @Delete(':id')
  @Scope('project')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive a project and its environments',
    description:
      'Archived, not deleted: the change history and upgrade plans still refer to it.',
  })
  archive(@Param('id') id: string): Promise<void> {
    return this.projects.archive(id);
  }

  @Post(':id/environments')
  @Scope('project')
  @ApiOperation({
    summary: 'Add an environment to a project',
    description:
      'Optionally starts with the components of another environment of the same project. Re-adding an archived environment restores it.',
  })
  @ApiCreatedResponse({ type: ProjectDto })
  addEnvironment(
    @Param('id') id: string,
    @Body() body: AddEnvironmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projects.addEnvironment(id, body, user.id);
  }

  @Patch(':id/engineers')
  @Scope('project')
  @ApiOperation({
    summary: 'Replace who is staffed on a project',
    description:
      'Takes the complete list, not a delta, so two people editing staffing at once cannot interleave into a set neither chose.',
  })
  @ApiParam({ name: 'id', example: 'SYP' })
  @ApiOkResponse({ type: ProjectDto })
  setEngineers(
    @Param('id') id: string,
    @Body() body: SetEngineersDto,
  ): Promise<ProjectDto> {
    return this.projects.setEngineers(id, body.engineerIds, body.leadId);
  }

  @Get('archived')
  @ApiOperation({ summary: 'Archived projects, newest first' })
  async archived(@CurrentUser() user: AuthenticatedUser) {
    const [visible, list] = await Promise.all([
      this.access.visibleProjectIds(user.id),
      this.projects.findArchived(),
    ]);
    return visible === null ? list : list.filter((p) => visible.includes(p.id));
  }

  @Post(':id/restore')
  @Scope('project')
  @ApiOperation({
    summary: 'Restore an archived project',
    description: 'Its environments archived with it come back too.',
  })
  @ApiOkResponse({ type: ProjectDto })
  restore(@Param('id') id: string): Promise<ProjectDto> {
    return this.projects.restore(id);
  }

  @Get(':id/activity')
  @Scope('project')
  @ApiOperation({
    summary: 'Everything recorded across a project, newest first',
    description:
      'One stream for the whole project rather than one call per environment.',
  })
  @ApiParam({ name: 'id', example: 'SYP' })
  activity(@Param('id') id: string) {
    return this.projects.activity(id);
  }

  @Get(':id')
  @Scope('project')
  @ApiOperation({ summary: 'One project, by id or code' })
  @ApiParam({ name: 'id', example: 'SYP' })
  @ApiOkResponse({ type: ProjectDto })
  findOne(@Param('id') id: string): Promise<ProjectDto> {
    return this.projects.findOne(id);
  }
}
