import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const ACTION_STATUSES = [
  'NOT_STARTED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'DEFERRED',
] as const;

export const COMM_STATUSES = [
  'NOT_REQUIRED',
  'PENDING',
  'SENT',
  'ACKNOWLEDGED',
] as const;

export class CreateUpgradeActionDto {
  @ApiProperty({ description: 'The cycle running out of support' })
  @IsUUID()
  technologyCycleId!: string;

  @ApiPropertyOptional({ example: '1.35.8', description: 'What it moves to' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  targetVersion?: string;

  @ApiProperty({
    type: [String],
    description: 'Environments this covers. Progress is tracked per environment.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'An action has to cover at least one environment.' })
  @ArrayMaxSize(60)
  @IsUUID('all', { each: true })
  deploymentIds!: string[];

  @ApiPropertyOptional({ description: 'Who is answerable for it' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsISO8601()
  plannedDate?: string;

  @ApiPropertyOptional({ enum: ACTION_STATUSES })
  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: (typeof ACTION_STATUSES)[number];

  @ApiPropertyOptional({ example: 'LIME-1042' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  jiraKey?: string;

  @ApiPropertyOptional({
    enum: COMM_STATUSES,
    description: 'Whether the customer has been told, where it affects them',
  })
  @IsOptional()
  @IsIn(COMM_STATUSES)
  customerComm?: (typeof COMM_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerCommNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class UpdateUpgradeActionDto extends PartialType(CreateUpgradeActionDto) {
  @ApiPropertyOptional({ example: '2026-10-14' })
  @IsOptional()
  @IsISO8601()
  completedDate?: string;
}

export class CompleteEnvironmentDto {
  @ApiProperty({ description: 'The environment that is now done' })
  @IsUUID()
  deploymentId!: string;

  @ApiPropertyOptional({ example: '2026-10-14', description: 'Defaults to today' })
  @IsOptional()
  @IsISO8601()
  completedAt?: string;
}
