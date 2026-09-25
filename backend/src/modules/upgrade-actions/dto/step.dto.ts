import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStepDto {
  @ApiProperty({ example: 'Take a snapshot of each host' })
  @IsString()
  @MinLength(1, { message: 'A step needs a description.' })
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'How long it is expected to take, in minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_080)
  estimateMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_080)
  estimateMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReorderStepsDto {
  @ApiProperty({
    type: [String],
    description: 'Every step id, in the order they should be worked through.',
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  stepIds!: string[];
}
