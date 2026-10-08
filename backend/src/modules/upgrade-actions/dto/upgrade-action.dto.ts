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
  ValidateIf,
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

export const DECISIONS = ['UPGRADE', 'EXTENDED_SUPPORT', 'ACCEPT_RISK', 'COMMERCIAL_QUOTE'] as const;

export class ProcessFieldsDto {
  @ApiPropertyOptional({ enum: DECISIONS, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(DECISIONS)
  decision?: (typeof DECISIONS)[number] | null;

  @ApiPropertyOptional({ nullable: true, description: 'Impact, compatibility and effort' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  assessment?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Who signed off an accepted risk' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  riskApprover?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2027-03-31' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  riskExpiresAt?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-10-08' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  customerNotifiedAt?: string | null;
}

export class CreateUpgradeActionDto extends ProcessFieldsDto {
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
