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

export class CreateTechnologyDto {
  @ApiProperty({ example: 'Redis', description: 'How engineers refer to it' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: COMPONENT_TYPES, example: 'DATABASE' })
  @IsIn(COMPONENT_TYPES)
  componentType!: (typeof COMPONENT_TYPES)[number];

  @ApiPropertyOptional({ example: 'Redis Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @ApiPropertyOptional({
    example: 'redis',
    description:
      'endoflife.date slug. Given one, every published cycle is imported with its real dates, so the technology is usable immediately.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eolSlug?: string;

  @ApiPropertyOptional({
    enum: CYCLE_RULES,
    description:
      'How a version maps to a cycle: MongoDB 8.0.32 belongs to cycle "8.0" (MAJOR_MINOR), Kubernetes 1.35.8 to "1.35" — while Docker 28.5.2 belongs to "28" (MAJOR).',
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
