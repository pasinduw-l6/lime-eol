import { AccessService } from '../access/access.service';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { Scope } from '../access/scope.decorator';
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateSubtaskDto,
  LinkIssueDto,
  LogWorkDto,
  TransitionDto,
  UpdateSubtaskDto,
} from './dto/link-issue.dto';
import { IssueTrackerService, parseDuration } from './issue-tracker.service';

@ApiTags('issue-tracker')
@Controller()
export class IssueTrackerController {
  constructor(
    private readonly tracker: IssueTrackerService,
    private readonly access: AccessService,
  ) {}

  @Get('integrations/jira/status')
  @ApiOperation({
    summary: 'Whether Jira is configured and reachable',
    description:
      'Reports that credentials exist and whether a call succeeds, never the credentials themselves.',
  })
  status() {
    return this.tracker.status();
  }

  @Get('upgrade-actions/:id/jira')
  @Scope('action')
  @ApiOperation({
    summary: 'The mirrored issue and its sub-tasks',
    description:
      'Reads the local mirror only. Jira is never called on a page load, so the panel still renders when Jira is down.',
  })
  read(@Param('id') id: string) {
    return this.tracker.read(id);
  }

  @Post('upgrade-actions/:id/jira/create')
  @Scope('action')
  @ApiOperation({
    summary: 'Raise the issue for this plan, with a step per environment',
    description:
      'Creates a new issue on the configured board and links it. Refused if the plan already has one — two tickets for one upgrade both drift, and neither is obviously the real one. Use this to retry after a failure, or for plans made before automatic creation was switched on.',
  })
  @ApiOkResponse({ description: 'The mirror, freshly synced' })
  create(@Param('id') id: string) {
    return this.tracker.createFor(id);
  }

  @Post('upgrade-actions/:id/jira/link')
  @Scope('action')
  @ApiOperation({
    summary: 'Point a plan at an issue that already exists',
    description:
      'The issue is read from Jira first, so an unknown key fails here rather than storing a link that never resolves.',
  })
  @ApiOkResponse({ description: 'The mirror, freshly synced' })
  link(@Param('id') id: string, @Body() body: LinkIssueDto) {
    return this.tracker.link(id, body.issueKey, body.integrationId);
  }

  @Post('upgrade-actions/:id/jira/sync')
  @Scope('action')
  @ApiOperation({ summary: 'Refresh this plan from Jira now' })
  sync(@Param('id') id: string) {
    return this.tracker.sync(id);
  }

  @Get('upgrade-actions/:id/jira/assignees')
  @Scope('action')
  @ApiOperation({
    summary: 'Who the tracker will let you assign work to',
    description:
      "Jira's own account list for this issue. Our engineer records are separate and cannot be used as assignees.",
  })
  assignees(@Param('id') id: string) {
    return this.tracker.assignees(id);
  }

  @Post('upgrade-actions/:id/jira/subtasks')
  @Scope('action')
  @ApiOperation({
    summary: 'Add a step under the linked issue',
    description:
      'Creates it in Jira and re-reads the mirror. Status, comments and time stay in Jira — this creates work, it does not manage it.',
  })
  @ApiOkResponse({ description: 'The mirror, including the new step' })
  addSubtask(@Param('id') id: string, @Body() body: CreateSubtaskDto) {
    return this.tracker.addSubtask(id, body);
  }

  @Patch('upgrade-actions/:id/jira/subtasks/:key')
  @Scope('action')
  @ApiOperation({ summary: 'Change a sub-task in Jira: title, assignee, dates or estimate' })
  updateSubtask(@Param('id') id: string, @Param('key') key: string, @Body() body: UpdateSubtaskDto) {
    const estimateSeconds = body.estimate === undefined ? undefined : parseDuration(body.estimate);
    if (body.estimate !== undefined && body.estimate.trim() !== '' && !estimateSeconds) {
      throw new BadRequestException('Enter the estimate like 4h, 1d or 2h 30m.');
    }
    return this.tracker.updateSubtask(id, key, {
      summary: body.summary?.trim(),
      assigneeId: body.assigneeId,
      startDate: body.startDate,
      dueDate: body.dueDate,
      estimateSeconds: estimateSeconds ?? undefined,
    });
  }

  @Get('jira/time-log')
  @ApiOperation({ summary: 'Time logged in Jira against plan sub-tasks, between two dates (inclusive)' })
  async timeLog(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    if (!valid.test(from ?? '') || !valid.test(to ?? '')) {
      throw new BadRequestException('Give from and to as YYYY-MM-DD.');
    }
    return this.tracker.timeLog(from, to, await this.access.visibleProjectIds(user.id));
  }

  @Get('upgrade-actions/:id/jira/subtasks/:key/transitions')
  @Scope('action')
  @ApiOperation({ summary: 'The statuses Jira allows this sub-task to move to' })
  transitions(@Param('id') id: string, @Param('key') key: string) {
    return this.tracker.transitions(id, key);
  }

  @Post('upgrade-actions/:id/jira/subtasks/:key/transitions')
  @Scope('action')
  @ApiOperation({ summary: 'Move a sub-task to another status' })
  transition(@Param('id') id: string, @Param('key') key: string, @Body() body: TransitionDto) {
    return this.tracker.transition(id, key, body.transitionId);
  }

  @Get('upgrade-actions/:id/jira/subtasks/:key/worklogs')
  @Scope('action')
  @ApiOperation({ summary: 'Time logged against a sub-task' })
  worklogs(@Param('id') id: string, @Param('key') key: string) {
    return this.tracker.worklogs(id, key);
  }

  @Post('upgrade-actions/:id/jira/subtasks/:key/worklogs')
  @Scope('action')
  @ApiOperation({ summary: 'Log time against a sub-task in Jira' })
  logWork(@Param('id') id: string, @Param('key') key: string, @Body() body: LogWorkDto) {
    return this.tracker.logWork(id, key, body);
  }

  @Delete('upgrade-actions/:id/jira/link')
  @Scope('action')
  @ApiOperation({
    summary: 'Forget the link',
    description: 'Leaves the Jira issue untouched. Only the mirror is dropped.',
  })
  unlink(@Param('id') id: string) {
    return this.tracker.unlink(id);
  }
}
