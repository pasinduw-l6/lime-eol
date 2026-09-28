import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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

export class CreateTechnologyDto {
  @ApiPropertyOptional({
    example: 'redis',
    description:
      'endoflife.date product slug, chosen from GET /technologies/catalogue. Omit it, and pass `internal: true` with a name, for something nobody publishes lifecycle dates for.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Lime',
    description:
      "Overrides the product's own label. Required for an internal technology.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Our own software, or anything no external source tracks. It carries no end-of-life dates, and its versions are recorded purely so the estate knows what is running where.',
  })
  @IsOptional()
  @IsBoolean()
  internal?: boolean;

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
