import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const INTEGRATION_KINDS = ['JIRA', 'TEAMS'] as const;
export type IntegrationKindName = (typeof INTEGRATION_KINDS)[number];

export class CreateIntegrationDto {
  @ApiProperty({ enum: INTEGRATION_KINDS })
  @IsIn(INTEGRATION_KINDS)
  kind!: IntegrationKindName;

  @ApiProperty({ example: 'DBANK Jira' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'https://dbank.atlassian.net', description: 'Jira only' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'sre@linearsix.com', description: 'Jira only' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'OPS', description: 'Jira only: the default board (project key)' })
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_]{1,9}$/, { message: 'A Jira project key is capitals and digits, like OPS.' })
  projectKey?: string;

  @ApiPropertyOptional({ enum: ['scoped', 'classic'], description: 'Jira only' })
  @IsOptional()
  @IsIn(['scoped', 'classic'])
  tokenType?: 'scoped' | 'classic';

  @ApiPropertyOptional({
    description: 'The Jira API token, or the Teams webhook URL. Write-only; never returned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  secret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateIntegrationDto extends PartialType(OmitType(CreateIntegrationDto, ['kind'])) {}
