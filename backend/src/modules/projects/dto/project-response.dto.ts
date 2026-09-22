import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComponentDto {
  @ApiProperty({ example: 'MongoDB' })
  technology!: string;

  @ApiProperty({ example: 'DATABASE' })
  componentType!: string;

  @ApiProperty({ example: '8.0' })
  version!: string;

  @ApiProperty({ example: '8.0', description: 'Support cycle this build belongs to' })
  cycle!: string;

  @ApiPropertyOptional({ example: '2029-10-31', nullable: true })
  eolDate!: string | null;

  @ApiPropertyOptional({ example: '2026-12-28', nullable: true })
  activeSupportEnd!: string | null;

  @ApiPropertyOptional({ example: '8.0.32', nullable: true })
  latestPatch!: string | null;

  @ApiPropertyOptional({
    example: 1135,
    nullable: true,
    description: 'Days until end of life; negative when already past',
  })
  daysToEol!: number | null;

  @ApiProperty({ enum: ['EOL', 'NEAR', 'SUPPORTED', 'UNKNOWN'] })
  status!: string;

  @ApiProperty({
    enum: ['API', 'MANUAL'],
    description: 'MANUAL cycles are never overwritten by the nightly sync',
  })
  eolSource!: string;
}

export class EnvironmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'PROD' })
  environment!: string;

  @ApiProperty({ example: 'CUSTOMER_SITE' })
  location!: string;

  @ApiPropertyOptional({ example: 'Siyapatha DC', nullable: true })
  locationDetail!: string | null;

  @ApiProperty({ type: [String], example: ['DevOps'] })
  owners!: string[];

  @ApiProperty({ type: [ComponentDto] })
  components!: ComponentDto[];
}

export class EngineerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Platform Admin' })
  name!: string;

  @ApiProperty({ example: 'PA' })
  initials!: string;

  @ApiProperty({ example: true })
  isLead!: boolean;
}

export class ProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Siyapatha' })
  name!: string;

  @ApiProperty({ example: 'Siyapatha' })
  customer!: string;

  @ApiProperty({ example: 'SYP' })
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  limeVersion!: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'ONBOARDING', 'PAUSED'] })
  status!: string;

  @ApiPropertyOptional({ example: '2023-01-01', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: [EngineerDto] })
  engineers!: EngineerDto[];

  @ApiProperty({ type: [EnvironmentDto] })
  environments!: EnvironmentDto[];

  @ApiProperty({
    example: { eol: 3, near: 0 },
    description: 'Distinct components at or near end of life across the project',
  })
  risk!: { eol: number; near: number };
}
