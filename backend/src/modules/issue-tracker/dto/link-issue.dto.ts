import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

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
