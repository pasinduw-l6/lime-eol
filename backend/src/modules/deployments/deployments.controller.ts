import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';
import { ChangeComponentDto, ComponentChangeDto } from './dto/change-component.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../auth/current-user.decorator';

@ApiTags('environments')
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Patch(':id/components')
  @ApiOperation({
    summary: 'Record the version an environment now runs',
    description:
      'Swaps the component and writes a history entry in one transaction, so recorded state and history cannot drift apart.',
  })
  @ApiParam({ name: 'id', description: 'Environment (deployment) id' })
  @ApiOkResponse({ type: ComponentChangeDto })
  change(
    @Param('id') id: string,
    @Body() body: ChangeComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ComponentChangeDto> {
    return this.deployments.changeComponent(id, body, user.id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Everything that changed in this environment',
    description: 'Newest first, by the date the change took effect.',
  })
  @ApiParam({ name: 'id', description: 'Environment (deployment) id' })
  @ApiOkResponse({ type: [ComponentChangeDto] })
  @ApiQuery({ name: 'technology', required: false })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31' })
  @ApiQuery({ name: 'reason', required: false })
  history(
    @Param('id') id: string,
    @Query('technology') technology?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('reason') reason?: string,
  ): Promise<ComponentChangeDto[]> {
    return this.deployments.history(id, { technology, from, to, reason });
  }

  @Get(':id/history/verify')
  @ApiOperation({
    summary: 'Check the change log has not been altered',
    description:
      'Recomputes the hash chain. Reports the sequence numbers where the stored hash stops matching, so tampering or a bad restore is visible.',
  })
  verify(@Param('id') id: string) {
    return this.deployments.verify(id);
  }

  @Get(':id/history.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="change-history.csv"')
  @ApiOperation({ summary: 'The change log as CSV, for auditors' })
  csv(@Param('id') id: string): Promise<string> {
    return this.deployments.historyCsv(id);
  }

  @Get('versions/available')
  @ApiOperation({
    summary: 'Versions on offer for a technology, grouped by cycle',
    description: 'What the version picker shows when recording a change.',
  })
  @ApiQuery({ name: 'technology', example: 'MongoDB' })
  @ApiQuery({
    name: 'currentVersion',
    required: false,
    example: '8.0.32',
    description: 'Only versions newer than this are returned',
  })
  versions(
    @Query('technology') technology: string,
    @Query('currentVersion') currentVersion?: string,
  ) {
    return this.deployments.versionsFor(technology, currentVersion);
  }
}
