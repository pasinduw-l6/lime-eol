import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
