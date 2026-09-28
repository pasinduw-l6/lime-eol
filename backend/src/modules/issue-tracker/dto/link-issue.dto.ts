import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
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
}

/**
 * A step to add under the linked issue.
 *
 * Note what is absent: no status, no time, no comments. Those are Jira's to
 * own, and offering them here would rebuild the very thing this replaced.
 */
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

  @ApiPropertyOptional({ example: '2026-11-14' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "The tracker's own account id, from the assignees endpoint.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  assigneeId?: string;
}
