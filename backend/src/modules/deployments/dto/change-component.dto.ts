import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CHANGE_REASONS = [
  'INITIAL_RECORD',
  'PLANNED_UPGRADE',
  'SECURITY_PATCH',
  'ROLLBACK',
  'DRIFT_CORRECTION',
  'DECOMMISSION',
] as const;

export class ChangeComponentDto {
  @ApiProperty({ example: 'MongoDB', description: 'Technology already in the registry' })
  @IsString()
  @MinLength(1)
  technology!: string;

  @ApiProperty({ example: '8.0.32', description: 'Version this environment now runs' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  toVersion!: string;

  @ApiPropertyOptional({
    example: '2026-09-22',
    description:
      'When the change actually happened in the environment. Defaults to today; reports use this, not when it was typed in.',
  })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;

  @ApiPropertyOptional({ example: 'Rolled out during the September window' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    enum: CHANGE_REASONS,
    description: 'Why it changed — an emergency patch is a different event from a planned upgrade',
  })
  @IsOptional()
  @IsIn(CHANGE_REASONS)
  reason?: (typeof CHANGE_REASONS)[number];

  @ApiPropertyOptional({ example: 'LIME-1042', description: 'Change request or ticket' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ticketRef?: string;

  @ApiPropertyOptional({
    example: 'https://git.example.com/infra/pull/218',
    description: 'Runbook, pull request or pipeline run evidencing the change',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  evidenceUrl?: string;

  @ApiPropertyOptional({
    description:
      'Id of an earlier entry this one corrects. Entries are never edited; a mistake is answered with a compensating entry.',
  })
  @IsOptional()
  @IsUUID()
  correctsId?: string;
}

export class ComponentChangeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 3, description: 'Position in this environment’s chain' })
  sequence!: number;

  @ApiProperty({ enum: CHANGE_REASONS })
  reason!: string;

  @ApiPropertyOptional({ example: 'LIME-1042', nullable: true })
  ticketRef!: string | null;

  @ApiPropertyOptional({ nullable: true })
  evidenceUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Entry this one corrects' })
  correctsId!: string | null;

  @ApiProperty({ description: 'SHA-256 chaining this entry to the previous one' })
  hash!: string;

  @ApiProperty({ example: 'MongoDB' })
  technology!: string;

  @ApiPropertyOptional({ example: '8.0', nullable: true })
  fromVersion!: string | null;

  @ApiPropertyOptional({ example: '8.0.32', nullable: true })
  toVersion!: string | null;

  @ApiProperty({ enum: ['INSTALL', 'UPGRADE', 'DOWNGRADE', 'REMOVE'] })
  changeType!: string;

  @ApiProperty({ example: '2026-09-22' })
  effectiveAt!: string;

  @ApiProperty({ example: '2026-09-22T09:14:00.000Z' })
  recordedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  recordedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;
}
