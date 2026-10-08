import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { CreateCycleDto, UpdateCycleDto } from './dto/cycle.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';
import { TechnologiesService } from './technologies.service';

@ApiTags('registry')
@Controller('technologies')
export class TechnologiesController {
  constructor(private readonly technologies: TechnologiesService) {}

  @Get()
  @ApiOperation({ summary: 'Technologies with their cycles and versions' })
  @ApiOkResponse({ description: 'Technologies ordered by name' })
  findAll() {
    return this.technologies.findAll();
  }

  @Get('catalogue')
  @ApiOperation({
    summary: 'Every product endoflife.date publishes — the only things addable',
    description:
      'Returned whole so the picker can filter as you type. Each row carries its logo, a suggested component type, and the local name if it is already registered.',
  })
  @ApiOkResponse({ description: 'Products ordered by label' })
  catalogue() {
    return this.technologies.catalogue();
  }

  @Post()
  @ApiOperation({
    summary: 'Register one of the published products',
    description:
      'Takes a catalogue slug. Name, component type, cycle rule and logo are read from the product, and every published cycle is imported in the same call, so it is deployable immediately.',
  })
  @ApiCreatedResponse({ description: 'The technology, with its imported cycles' })
  create(@Body() body: CreateTechnologyDto) {
    return this.technologies.create(body);
  }

  @Patch('cycles/:cycleId')
  @ApiOperation({
    summary: 'Change a cycle',
    description:
      'Changing a date marks the cycle MANUAL, so the vendor sync no longer overwrites it, and records the old and new value.',
  })
  updateCycle(@Param('cycleId') cycleId: string, @Body() body: UpdateCycleDto) {
    return this.technologies.updateCycle(cycleId, body);
  }

  @Delete('cycles/:cycleId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a cycle',
    description: 'Refused while any environment, plan or history entry refers to it.',
  })
  deleteCycle(@Param('cycleId') cycleId: string): Promise<void> {
    return this.technologies.deleteCycle(cycleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One technology with its cycles and versions' })
  findOne(@Param('id') id: string) {
    return this.technologies.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change the details of a technology' })
  update(@Param('id') id: string, @Body() body: UpdateTechnologyDto) {
    return this.technologies.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive a technology',
    description: 'Refused while any environment still runs one of its versions.',
  })
  archive(@Param('id') id: string): Promise<void> {
    return this.technologies.archive(id);
  }

  @Post(':id/cycles')
  @ApiOperation({
    summary: 'Add a cycle by hand',
    description: 'For releases a vendor does not publish, such as Lime itself. Recorded as MANUAL.',
  })
  @ApiCreatedResponse({ description: 'The technology, with the new cycle' })
  createCycle(@Param('id') id: string, @Body() body: CreateCycleDto) {
    return this.technologies.createCycle(id, body);
  }
}
