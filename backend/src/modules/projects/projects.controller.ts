import {
  Body,
  Controller,
  Get,
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
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'Every project with its environments and their components',
    description:
      'One call per screen: each environment carries its components with lifecycle state already resolved, so the client never fans out per row.',
  })
  @ApiOkResponse({ type: [ProjectDto] })
  findAll(): Promise<ProjectDto[]> {
    return this.projects.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Create a project with its environments and their stack',
    description:
      'Each component is recorded as an INSTALL in the change history, so a new project starts with a complete record rather than appearing fully formed.',
  })
  @ApiCreatedResponse({ type: ProjectDto })
  create(
    @Body() body: CreateProjectDto,
    // Every component becomes an INSTALL in the history, attributed to whoever
    // is signed in rather than to whoever the client claimed to be.
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDto> {
    return this.projects.create(body, user.id);
  }

  @Patch(':id/engineers')
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

  @Get(':id/activity')
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
  @ApiOperation({ summary: 'One project, by id or code' })
  @ApiParam({ name: 'id', example: 'SYP' })
  @ApiOkResponse({ type: ProjectDto })
  findOne(@Param('id') id: string): Promise<ProjectDto> {
    return this.projects.findOne(id);
  }
}
