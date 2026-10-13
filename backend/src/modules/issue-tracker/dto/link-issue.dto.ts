import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  MinLength,
} from 'class-validator';

export class LinkIssueDto {
  @ApiProperty({
    example: 'OPS-1042',
    description: 'An issue that already exists in Jira. Case is normalised.',
  })
  @IsString()
  @MinLength(3, { message: 'Give the Jira key, e.g. OPS-1042.' })
  @MaxLength(64)
  issueKey!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The Jira connection to read it from. Omit to use the project one; null for the server default.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  integrationId?: string | null;
}

export class UpdateSubtaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255, { message: 'Jira summaries stop at 255 characters.' })
  summary?: string;

  @ApiPropertyOptional({ nullable: true, description: "Jira account id, or null to unassign" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(128)
  assigneeId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-10' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  startDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-14' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

  @ApiPropertyOptional({ example: '6h' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  estimate?: string;
}

export class TransitionDto {
  @ApiProperty({ description: 'A transition id from the transitions list' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  transitionId!: string;
}

export class LogWorkDto {
  @ApiProperty({ example: '1h 30m' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  time!: string;

  @ApiProperty({ example: '2026-10-09' })
  @IsISO8601()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class CreateSubtaskDto {
  @ApiProperty({ example: 'Upgrade DEV and smoke test' })
  @IsString()
  @MinLength(1, { message: 'A step needs a title.' })
  @MaxLength(255, { message: 'Jira summaries stop at 255 characters.' })
  summary!: string;

  @ApiPropertyOptional({ description: 'Anything the person doing it needs' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-14' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({ example: '4h', description: 'Original estimate: 30m, 4h, 1d (8h), 1w (5d)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  estimate?: string;

  @ApiPropertyOptional({
    description: "The tracker's own account id, from the assignees endpoint.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  assigneeId?: string;
}
