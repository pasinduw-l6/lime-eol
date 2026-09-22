import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}

export class ComponentChangeDto {
  @ApiProperty()
  id!: string;

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
