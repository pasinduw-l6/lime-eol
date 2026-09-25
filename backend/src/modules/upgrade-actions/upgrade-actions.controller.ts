import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { ActionStepsService } from './action-steps.service';
import {
  BlockStepDto,
  CreateStepDto,
  LogTimeDto,
  ReorderStepsDto,
  UpdateStepDto,
} from './dto/step.dto';

@ApiTags('upgrade-actions')
@Controller('upgrade-actions')
export class UpgradeActionsController {
  constructor(
    private readonly actions: UpgradeActionsService,
    private readonly steps: ActionStepsService,
  ) {}

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
  @ApiOperation({ summary: 'Change a plan' })
  update(@Param('id') id: string, @Body() body: UpdateUpgradeActionDto) {
    return this.actions.update(id, body);
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

  // ---- the to-do list -------------------------------------------------------

  @Get(':id/steps')
  @ApiOperation({ summary: 'The to-do list, in the order it is worked through' })
  listSteps(@Param('id') id: string) {
    return this.steps.list(id);
  }

  @Post(':id/steps')
  @ApiOperation({ summary: 'Add a step to the end of the list' })
  addStep(@Param('id') id: string, @Body() body: CreateStepDto) {
    return this.steps.create(id, body);
  }

  @Patch(':id/steps/:stepId')
  @ApiOperation({ summary: 'Edit a step' })
  updateStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: UpdateStepDto,
  ) {
    return this.steps.update(id, stepId, body);
  }

  @Post(':id/steps/:stepId/start')
  @ApiOperation({
    summary: 'Start the clock on a stretch of work',
    description:
      'Effort accumulates across stretches, because an upgrade is picked up and put down over weeks. Several steps may run at once — refusing that would only teach people to leave the clock off.',
  })
  startStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.steps.start(id, stepId);
  }

  @Post(':id/steps/:stepId/pause')
  @ApiOperation({ summary: 'Stop the clock and bank what that stretch took' })
  pauseStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.steps.pause(id, stepId);
  }

  @Post(':id/steps/:stepId/time')
  @ApiOperation({ summary: 'Log effort that happened away from the clock' })
  logStepTime(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: LogTimeDto,
  ) {
    return this.steps.logTime(id, stepId, body);
  }

  @Post(':id/steps/:stepId/block')
  @ApiOperation({
    summary: 'Mark a step as waiting on something outside the team',
    description:
      'Distinct from not started: work nobody can proceed with is a different problem from work nobody has picked up.',
  })
  blockStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: BlockStepDto,
  ) {
    return this.steps.block(id, stepId, body.reason);
  }

  @Post(':id/steps/:stepId/complete')
  @ApiOperation({ summary: 'Tick a step off, timing it from when it started' })
  completeStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Headers('x-acting-user') actingUser?: string,
  ) {
    return this.steps.complete(id, stepId, actingUser);
  }

  @Post(':id/steps/:stepId/reopen')
  @ApiOperation({ summary: 'Put a completed step back on the list' })
  reopenStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.steps.reopen(id, stepId);
  }

  @Patch(':id/steps')
  @ApiOperation({ summary: 'Reorder the list' })
  reorderSteps(@Param('id') id: string, @Body() body: ReorderStepsDto) {
    return this.steps.reorder(id, body);
  }

  @Delete(':id/steps/:stepId')
  @ApiOperation({ summary: 'Remove a step' })
  removeStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.steps.remove(id, stepId);
  }
}
