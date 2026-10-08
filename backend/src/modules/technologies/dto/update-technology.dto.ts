import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { COMPONENT_TYPES, CYCLE_RULES } from './create-technology.dto';

export const SCOPES = ['INFRASTRUCTURE', 'APPLICATION'] as const;

export class UpdateTechnologyDto {
  @ApiPropertyOptional({ example: 'MongoDB' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: COMPONENT_TYPES })
  @IsOptional()
  @IsIn(COMPONENT_TYPES)
  componentType?: (typeof COMPONENT_TYPES)[number];

  @ApiPropertyOptional({
    enum: SCOPES,
    description: 'Infrastructure component, or application dependency shipped through Lime releases',
  })
  @IsOptional()
  @IsIn(SCOPES)
  scope?: (typeof SCOPES)[number];

  @ApiPropertyOptional({ example: 'MongoDB Inc.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @ApiPropertyOptional({ enum: CYCLE_RULES })
  @IsOptional()
  @IsIn(CYCLE_RULES)
  cycleRule?: (typeof CYCLE_RULES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
