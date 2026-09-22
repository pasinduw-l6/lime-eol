import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NewEnvironmentDto {
  @ApiProperty({ enum: ['DEV', 'UAT', 'PROD'] })
  @IsIn(['DEV', 'UAT', 'PROD'])
  environment!: 'DEV' | 'UAT' | 'PROD';

  @ApiProperty({ enum: ['EC2', 'CUSTOMER_SITE'] })
  @IsIn(['EC2', 'CUSTOMER_SITE'])
  location!: 'EC2' | 'CUSTOMER_SITE';

  @ApiPropertyOptional({ example: 'ap-south-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationDetail?: string;
}

export class StackEntryDto {
  @ApiProperty({ example: 'MongoDB', description: 'Technology already in the registry' })
  @IsString()
  @MinLength(1)
  technology!: string;

  @ApiProperty({ example: '8.0', description: 'Version this project runs' })
  @IsString()
  @MinLength(1)
  version!: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Siyapatha' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Siyapatha', description: 'Customer this project belongs to' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  customer!: string;

  @ApiProperty({ example: 'SYP' })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  code!: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ONBOARDING', 'PAUSED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ONBOARDING', 'PAUSED'])
  status?: 'ACTIVE' | 'ONBOARDING' | 'PAUSED';

  @ApiPropertyOptional({ example: '2026.1' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  limeVersion?: string;

  @ApiPropertyOptional({ example: '2023-01-01' })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @ApiPropertyOptional({ type: [String], description: 'Engineers staffed on it' })
  @IsOptional()
  @IsArray()
  engineerIds?: string[];

  @ApiProperty({ type: [NewEnvironmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NewEnvironmentDto)
  environments!: NewEnvironmentDto[];

  @ApiProperty({
    type: [StackEntryDto],
    description:
      'What every environment starts with. Each one is recorded as an INSTALL in the change history, so the project has a complete record from day one.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StackEntryDto)
  stack!: StackEntryDto[];
}
