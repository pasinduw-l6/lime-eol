import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTechnologyDto } from './dto/create-technology.dto';
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
}
