import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @Can('integration:write')
  @ApiOperation({ summary: 'Jira and Teams connections, including the server default from .env' })
  list() {
    return this.integrations.list();
  }

  @Get('options')
  @ApiOperation({ summary: 'Enabled connections to pick from, without any credentials' })
  options() {
    return this.integrations.options();
  }

  @Post()
  @Can('integration:write')
  @ApiOperation({ summary: 'Add a Jira board or a Teams channel, then test it' })
  create(@Body() body: CreateIntegrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.create(body, user.id);
  }

  @Patch(':id')
  @Can('integration:write')
  @ApiOperation({ summary: 'Change a connection. A blank secret keeps the stored one.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateIntegrationDto) {
    return this.integrations.update(id, body);
  }

  @Post(':id/test')
  @Can('integration:write')
  @ApiOperation({ summary: 'Check the connection and record the result' })
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.integrations.test(id);
  }

  @Post(':id/default')
  @Can('integration:write')
  @ApiOperation({
    summary: 'Use this connection for projects that picked none',
    description: 'Pass env-jira or env-teams to go back to the server .env connection.',
  })
  makeDefault(@Param('id') id: string) {
    return this.integrations.makeDefault(id);
  }

  @Delete(':id')
  @Can('integration:write')
  @HttpCode(204)
  @ApiQuery({ name: 'moveTo', required: false, description: 'Connection to move its projects to; omitted means the default' })
  @ApiOperation({ summary: 'Remove a connection and move the projects that used it' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Query('moveTo') moveTo?: string): Promise<void> {
    return this.integrations.remove(id, moveTo);
  }
}
