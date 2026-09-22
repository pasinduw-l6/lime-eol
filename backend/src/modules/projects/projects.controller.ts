import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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

  @Get(':id')
  @ApiOperation({ summary: 'One project, by id or code' })
  @ApiParam({ name: 'id', example: 'SYP' })
  @ApiOkResponse({ type: ProjectDto })
  findOne(@Param('id') id: string): Promise<ProjectDto> {
    return this.projects.findOne(id);
  }
}
