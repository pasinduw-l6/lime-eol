import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateSubtaskDto, LinkIssueDto } from './dto/link-issue.dto';
import { IssueTrackerService } from './issue-tracker.service';

@ApiTags('issue-tracker')
@Controller()
export class IssueTrackerController {
  constructor(private readonly tracker: IssueTrackerService) {}

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
  @ApiOperation({
    summary: 'The mirrored issue and its sub-tasks',
    description:
      'Reads the local mirror only. Jira is never called on a page load, so the panel still renders when Jira is down.',
  })
  read(@Param('id') id: string) {
    return this.tracker.read(id);
  }

  @Post('upgrade-actions/:id/jira/link')
  @ApiOperation({
    summary: 'Point a plan at an issue that already exists',
    description:
      'The issue is read from Jira first, so an unknown key fails here rather than storing a link that never resolves.',
  })
  @ApiOkResponse({ description: 'The mirror, freshly synced' })
  link(@Param('id') id: string, @Body() body: LinkIssueDto) {
    return this.tracker.link(id, body.issueKey);
  }

  @Post('upgrade-actions/:id/jira/sync')
  @ApiOperation({ summary: 'Refresh this plan from Jira now' })
  sync(@Param('id') id: string) {
    return this.tracker.sync(id);
  }

  @Get('upgrade-actions/:id/jira/assignees')
  @ApiOperation({
    summary: 'Who the tracker will let you assign work to',
    description:
      "Jira's own account list for this issue. Our engineer records are separate and cannot be used as assignees.",
  })
  assignees(@Param('id') id: string) {
    return this.tracker.assignees(id);
  }

  @Post('upgrade-actions/:id/jira/subtasks')
  @ApiOperation({
    summary: 'Add a step under the linked issue',
    description:
      'Creates it in Jira and re-reads the mirror. Status, comments and time stay in Jira — this creates work, it does not manage it.',
  })
  @ApiOkResponse({ description: 'The mirror, including the new step' })
  addSubtask(@Param('id') id: string, @Body() body: CreateSubtaskDto) {
    return this.tracker.addSubtask(id, body);
  }

  @Delete('upgrade-actions/:id/jira/link')
  @ApiOperation({
    summary: 'Forget the link',
    description: 'Leaves the Jira issue untouched. Only the mirror is dropped.',
  })
  unlink(@Param('id') id: string) {
    return this.tracker.unlink(id);
  }
}
