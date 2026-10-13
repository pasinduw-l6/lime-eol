import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Delete(':id')
  @Can('integration:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a connection. Projects using it fall back to the server default.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.integrations.remove(id);
  }
}
