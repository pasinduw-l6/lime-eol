import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { EolField } from '../ports/eol-data-source.port';

export const EOL_FIELDS: EolField[] = ['eol', 'eoas', 'eoes'];

export class QueryEolProductDto {
  @ApiPropertyOptional({
    enum: EOL_FIELDS,
    default: 'eol',
    description:
      'Which support phase counts as end of life: security support (eol), active support (eoas) or extended/commercial support (eoes)',
  })
  @IsOptional()
  @IsIn(EOL_FIELDS)
  eolField?: EolField;
}

export class QueryEolProductListDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive filter on slug, label or alias',
    example: 'mongo',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by category (see GET /eol/categories)',
    example: 'database',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag (see GET /eol/tags). Ignored when category is set.',
    example: 'javascript-runtime',
  })
  @IsOptional()
  @IsString()
  tag?: string;
}
