import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateLimeReleaseDto {
  @ApiProperty({ example: '3.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version!: string;

  @ApiPropertyOptional({ nullable: true, example: '2027-01-15' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  releaseDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2031-01-15',
    description: 'End of support. Defaults to four years after the release date.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  supportEnd?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateLimeReleaseDto extends PartialType(CreateLimeReleaseDto) {}

export class CompatibilityDto {
  @ApiProperty({ type: [String], description: 'Technology versions this release supports' })
  @IsArray()
  @IsUUID('all', { each: true })
  techVersionIds!: string[];
}
