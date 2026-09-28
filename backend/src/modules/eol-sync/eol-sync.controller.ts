import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  EolProductDto,
  EolProductSummaryDto,
  EolReleaseDto,
} from './dto/eol-product.dto';
import {
  QueryEolProductDto,
  QueryEolProductListDto,
} from './dto/query-eol-product.dto';
import { EolLookupService } from './eol-lookup.service';

@ApiTags('eol')
@Controller('eol')
export class EolSyncController {
  constructor(private readonly lookup: EolLookupService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Products available from endoflife.date',
    description:
      'Used to find the slug for a technology before registering it. Cached for an hour.',
  })
  @ApiOkResponse({ type: [EolProductSummaryDto] })
  listProducts(
    @Query() query: QueryEolProductListDto,
  ): Promise<EolProductSummaryDto[]> {
    return this.lookup.listProducts(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Product categories, for filtering the picker' })
  @ApiOkResponse({ type: [String] })
  listCategories(): Promise<string[]> {
    return this.lookup.listCategories();
  }

  @Get('tags')
  @ApiOperation({ summary: 'Product tags, for filtering the picker' })
  @ApiOkResponse({ type: [String] })
  listTags(): Promise<string[]> {
    return this.lookup.listTags();
  }

  @Get('products/:slug')
  @ApiOperation({
    summary: 'Release cycles and lifecycle dates for one product',
    description:
      'Dates are already mapped to the registry’s fields, with daysToEol computed. eolField selects which support phase counts as end of life.',
  })
  @ApiParam({ name: 'slug', example: 'nodejs' })
  @ApiOkResponse({ type: EolProductDto })
  getProduct(
    @Param('slug') slug: string,
    @Query() query: QueryEolProductDto,
  ): Promise<EolProductDto> {
    return this.lookup.getProduct(slug, query.eolField ?? 'eol');
  }

  @Get('products/:slug/releases/latest')
  @ApiOperation({
    summary: 'Newest release cycle of a product',
    description: 'Suggests the upgrade target when planning an action.',
  })
  @ApiParam({ name: 'slug', example: 'nodejs' })
  @ApiOkResponse({ type: EolReleaseDto })
  getLatestRelease(
    @Param('slug') slug: string,
    @Query() query: QueryEolProductDto,
  ): Promise<EolReleaseDto> {
    return this.lookup.getRelease(slug, 'latest', query.eolField ?? 'eol');
  }

  @Get('products/:slug/releases/:cycle')
  @ApiOperation({
    summary: 'One release cycle of a product',
    description:
      'Returns 404 when the product does not publish that cycle, which is how a registered version is checked against the source.',
  })
  @ApiParam({ name: 'slug', example: 'nodejs' })
  @ApiParam({ name: 'cycle', example: '24' })
  @ApiOkResponse({ type: EolReleaseDto })
  getRelease(
    @Param('slug') slug: string,
    @Param('cycle') cycle: string,
    @Query() query: QueryEolProductDto,
  ): Promise<EolReleaseDto> {
    return this.lookup.getRelease(slug, cycle, query.eolField ?? 'eol');
  }
}
