import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EolProductDto, EolProductSummaryDto } from './dto/eol-product.dto';
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
}
