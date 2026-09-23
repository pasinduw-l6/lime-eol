import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { TechnologiesService } from './technologies.service';

/**
 * The registry: technologies and their support cycles, including cycles
 * entered by hand for products endoflife.date no longer publishes.
 */
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

  @Get('sources')
  @ApiOperation({
    summary: 'Products the lifecycle source publishes, for picking a slug',
    description:
      'Engineers know the product, not the slug — Red Hat Enterprise Linux is "rhel". Searching the source means the slug is chosen, not guessed.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'redis' })
  searchSource(@Query('q') q?: string) {
    return this.technologies.searchSource(q ?? '');
  }

  @Post()
  @ApiOperation({
    summary: 'Register a technology, importing its published cycles',
    description:
      'Given an endoflife.date slug, every cycle is imported with its real dates in the same call, so the technology can be deployed immediately.',
  })
  @ApiCreatedResponse({ description: 'The technology, with its imported cycles' })
  create(@Body() body: CreateTechnologyDto) {
    return this.technologies.create(body);
  }
}
