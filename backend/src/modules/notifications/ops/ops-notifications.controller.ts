import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CustomMessageDto } from './custom-message.dto';
import { OpsNotificationsService, Pass } from './ops-notifications.service';

/** What the token carries. The display name is looked up in the service. */
interface Actor {
  id: string;
  email: string;
  role: string;
}

/**
 * The operations view.
 *
 * Restricted to ADMIN, which is what the SREs hold. The page is kept out of the
 * navigation, but that is tidiness rather than a control - the route name is in
 * the JavaScript bundle for anyone who cares to look. @Roles is the control.
 */
@ApiTags('ops')
@Controller('ops/notifications')
@Roles('ADMIN')
export class OpsNotificationsController {
  constructor(private readonly ops: OpsNotificationsService) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Render a message without sending it',
    description:
      'Returns the exact Adaptive Card that would be posted, so the page can show what Teams will show. A mention that cannot be matched breaks the whole card in Teams rather than degrading, which is why this exists.',
  })
  @ApiOkResponse({ description: 'The Adaptive Card payload' })
  preview(@Body() body: CustomMessageDto, @Req() request: { user: Actor }) {
    return this.ops.preview(body, request.user);
  }

  @Post('send')
  @ApiOperation({
    summary: 'Post a message to the channel',
    description:
      'Never deduplicated: sending the same thing twice is a decision, not a fault. Every send is recorded against the account that made it.',
  })
  send(@Body() body: CustomMessageDto, @Req() request: { user: Actor }) {
    return this.ops.send(body, request.user);
  }

  @Post('run/:pass')
  @ApiOperation({
    summary: 'Run a scheduled pass now',
    description:
      'pass is eol, events or digest. With force=true, whatever that pass has already announced is forgotten first, so it says it again — for when the team missed it, or an old warning has become relevant.',
  })
  @ApiQuery({ name: 'force', required: false, example: 'false' })
  run(@Param('pass') pass: Pass, @Query('force') force?: string) {
    return this.ops.run(pass, force === 'true');
  }

  @Delete('suppression/:pass')
  @ApiOperation({
    summary: 'Forget what a pass has already announced',
    description:
      'The next run says it again. Does not send anything by itself.',
  })
  clear(@Param('pass') pass: Pass) {
    return this.ops.clearSuppression(pass);
  }

  @Get('history')
  @ApiOperation({ summary: 'What has been announced, newest first' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  history(@Query('limit') limit?: string) {
    return this.ops.history(Number(limit) || 50);
  }

  @Post('test')
  @ApiOperation({
    summary: 'Post a card that only says the connection works',
    description:
      'Answers "is it broken, or is there just nothing to say?" without waiting for something to go wrong.',
  })
  test(@Req() request: { user: Actor }) {
    return this.ops.test(request.user);
  }
}
