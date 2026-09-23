import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const COMPONENT_TYPES = [
  'DATABASE',
  'RUNTIME',
  'FRAMEWORK',
  'OS',
  'CONTAINER',
  'ORCHESTRATION',
  'MESSAGING',
  'LIBRARY',
  'OTHER',
] as const;

export const CYCLE_RULES = ['MAJOR', 'MAJOR_MINOR'] as const;

/**
 * Registers one of the products endoflife.date publishes.
 *
 * The slug is the only required field: everything else is read from the product
 * and may be overridden. A technology cannot be invented here — one with no
 * published lifecycle dates would be a component nobody can track.
 */
export class CreateTechnologyDto {
  @ApiProperty({
    example: 'redis',
    description:
      'endoflife.date product slug, chosen from GET /technologies/catalogue',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional({
    example: 'Redis',
    description: "Overrides the product's own label, for a local name",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    enum: COMPONENT_TYPES,
    description: "Overrides what is inferred from the product's category and tags",
  })
  @IsOptional()
  @IsIn(COMPONENT_TYPES)
  componentType?: (typeof COMPONENT_TYPES)[number];

  @ApiPropertyOptional({ example: 'Redis Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @ApiPropertyOptional({
    enum: CYCLE_RULES,
    description:
      'Overrides what is read from the cycles the product publishes: MongoDB ships "8.0" (MAJOR_MINOR), Docker ships "28" (MAJOR).',
  })
  @IsOptional()
  @IsIn(CYCLE_RULES)
  cycleRule?: (typeof CYCLE_RULES)[number];

  @ApiPropertyOptional({ example: 'Session store for the reporting service' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
