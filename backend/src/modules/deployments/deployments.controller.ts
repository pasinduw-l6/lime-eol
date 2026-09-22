import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';
import { ChangeComponentDto, ComponentChangeDto } from './dto/change-component.dto';

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
  ): Promise<ComponentChangeDto> {
    return this.deployments.changeComponent(id, body);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Everything that changed in this environment',
    description: 'Newest first, by the date the change took effect.',
  })
  @ApiParam({ name: 'id', description: 'Environment (deployment) id' })
  @ApiOkResponse({ type: [ComponentChangeDto] })
  history(@Param('id') id: string): Promise<ComponentChangeDto[]> {
    return this.deployments.history(id);
  }

  @Get('versions/available')
  @ApiOperation({
    summary: 'Versions on offer for a technology, grouped by cycle',
    description: 'What the version picker shows when recording a change.',
  })
  @ApiQuery({ name: 'technology', example: 'MongoDB' })
  versions(@Query('technology') technology: string) {
    return this.deployments.versionsFor(technology);
  }
}
