import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCycleDto {
  @ApiProperty({ example: '2.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  cycle!: string;

  @ApiPropertyOptional({ example: 'Lime 2.0' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: '2025-03-01', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  releaseDate?: string | null;

  @ApiPropertyOptional({
    example: '2027-03-01',
    nullable: true,
    description: 'End of full support. After it only security fixes are released.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  activeSupportEnd?: string | null;

  @ApiPropertyOptional({ example: '2029-03-01', nullable: true, description: 'End of support' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  eolDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMaintained?: boolean;

  @ApiPropertyOptional({ example: '2.0.4', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  latestPatch?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['2.0.0', '2.0.4'],
    description: 'The complete list of versions in this cycle',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  versions?: string[];
}

export class UpdateCycleDto extends PartialType(CreateCycleDto) {}
