import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Effort is stored in minutes and entered in whatever unit suits.
 *
 * A platform upgrade is measured in days or weeks; storing two units would let
 * them disagree, so the interface converts and the database holds one number.
 */
const MAX_ESTIMATE_MINUTES = 60 * 24 * 365;

export class CreateStepDto {
  @ApiProperty({ example: 'Agree the maintenance window with the customer' })
  @IsString()
  @MinLength(1, { message: 'A step needs a description.' })
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: 'Anything the person doing it needs' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: 960,
    description: 'Expected effort in minutes. 960 is two working days.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ESTIMATE_MINUTES)
  estimateMinutes?: number;

  @ApiPropertyOptional({ example: '2026-11-14' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Who is doing this particular step' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

/**
 * Every field is optional, and null is distinct from absent.
 *
 * Absent leaves the value alone; null clears it. Without that distinction a
 * step could be given an owner but never have one taken away.
 */
export class UpdateStepDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ESTIMATE_MINUTES)
  estimateMinutes?: number;

  @ApiPropertyOptional({ nullable: true, description: 'null clears the date' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null unassigns' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}

export class LogTimeDto {
  @ApiProperty({
    example: 120,
    description: 'Minutes to add. Negative corrects an overcount.',
  })
  @IsInt()
  @Min(-MAX_ESTIMATE_MINUTES)
  @Max(MAX_ESTIMATE_MINUTES)
  minutes!: number;
}

export class BlockStepDto {
  @ApiProperty({ example: 'Waiting on the customer to confirm the window' })
  @IsString()
  @MinLength(1, { message: 'Say what it is blocked on.' })
  @MaxLength(500)
  reason!: string;
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
