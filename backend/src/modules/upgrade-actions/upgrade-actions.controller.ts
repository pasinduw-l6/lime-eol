import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CompleteEnvironmentDto,
  CreateUpgradeActionDto,
  UpdateUpgradeActionDto,
} from './dto/upgrade-action.dto';
import { UpgradeActionsService } from './upgrade-actions.service';
import { Can } from '../auth/can.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('upgrade-actions')
@Controller('upgrade-actions')
export class UpgradeActionsController {
  constructor(private readonly actions: UpgradeActionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Every upgrade action, with per-environment progress',
    description:
      'Each environment carries whether it is marked done and whether a recorded change agrees — so a plan claiming completion with nothing behind it is visible.',
  })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.actions.findAll({ projectId, assigneeId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'One upgrade action' })
  findOne(@Param('id') id: string) {
    return this.actions.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Plan an upgrade against a cycle running out' })
  @ApiCreatedResponse({ description: 'The action, with its environments' })
  create(@Body() body: CreateUpgradeActionDto) {
    return this.actions.create(body);
  }

  @Patch(':id')
  @Can('estate:write', 'plan:notice', 'plan:decision', 'plan:assess')
  @ApiOperation({
    summary: 'Change a plan',
    description:
      'Each field belongs to a role: notice fields to the BA team, the decision to account managers, the assessment to Product, the rest to SRE / DevOps.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUpgradeActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actions.update(id, body, user.role);
  }

  @Post(':id/environments/complete')
  @ApiOperation({
    summary: 'Mark one environment done',
    description:
      'The action completes on its own once every environment it covers has.',
  })
  @ApiOkResponse({ description: 'The action, with progress updated' })
  completeEnvironment(
    @Param('id') id: string,
    @Body() body: CompleteEnvironmentDto,
  ) {
    return this.actions.completeEnvironment(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Drop a plan' })
  remove(@Param('id') id: string) {
    return this.actions.remove(id);
  }
}
