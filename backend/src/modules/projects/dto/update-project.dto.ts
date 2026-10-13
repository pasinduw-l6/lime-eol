import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'DFCC' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: '3.4.20',
    description: 'Free text: a release that does not exist here yet can be typed in.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  limeVersion?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ONBOARDING', 'PAUSED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ONBOARDING', 'PAUSED'])
  status?: 'ACTIVE' | 'ONBOARDING' | 'PAUSED';

  @ApiPropertyOptional({ example: '2024-04-01' })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ nullable: true, description: 'A Jira connection id; null for the server default' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  jiraIntegrationId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'OPS', description: 'The board; null for the connection default' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(/^[A-Za-z][A-Za-z0-9_]{1,9}$/, { message: 'A Jira project key is letters and digits, like OPS.' })
  jiraProjectKey?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'A Teams channel id; null for the server default' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teamsIntegrationId?: string | null;
}
