import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDto } from './dto/project-response.dto';
import { ProjectsService } from './projects.service';

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
    @Headers('x-acting-user') actingUser?: string,
  ): Promise<ProjectDto> {
    return this.projects.create(body, actingUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One project, by id or code' })
  @ApiParam({ name: 'id', example: 'SYP' })
  @ApiOkResponse({ type: ProjectDto })
  findOne(@Param('id') id: string): Promise<ProjectDto> {
    return this.projects.findOne(id);
  }
}
