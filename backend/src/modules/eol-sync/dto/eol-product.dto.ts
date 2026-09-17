import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EolProductSummaryDto {
  @ApiProperty({ example: 'nodejs', description: 'endoflife.date product slug' })
  slug!: string;

  @ApiProperty({ example: 'Node.js' })
  label!: string;

  @ApiProperty({ example: 'framework' })
  category!: string;

  @ApiProperty({ type: [String], example: ['node'] })
  aliases!: string[];

  @ApiProperty({ type: [String], example: ['javascript-runtime'] })
  tags!: string[];
}

export class EolReleaseDto {
  @ApiProperty({ example: '24', description: 'Cycle identifier' })
  cycle!: string;

  @ApiProperty({ example: '24 (LTS)' })
  label!: string;

  @ApiPropertyOptional({ example: '2025-05-06', nullable: true })
  releaseDate!: string | null;

  @ApiProperty({ example: true })
  isLts!: boolean;

  @ApiPropertyOptional({
    example: '2026-10-20',
    nullable: true,
    description: 'End of active support (eoasFrom)',
  })
  activeSupportEnd!: string | null;

  @ApiPropertyOptional({
    example: '2028-04-30',
    nullable: true,
    description: 'End of life for the technology’s configured eolField',
  })
  eolDate!: string | null;

  @ApiPropertyOptional({ example: '24.21.0', nullable: true })
  latestSupported!: string | null;

  @ApiProperty({ example: true, description: 'Still receiving any support' })
  isMaintained!: boolean;

  @ApiPropertyOptional({
    example: 227,
    nullable: true,
    description: 'Days until eolDate; negative when already past',
  })
  daysToEol!: number | null;
}

export class EolProductDto extends EolProductSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  htmlUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  releasePolicyUrl!: string | null;

  @ApiProperty({
    description: 'What this product calls each support phase',
    example: { eoas: 'Active Support', eol: 'Security Support' },
  })
  phaseLabels!: Record<string, string | null>;

  @ApiProperty({ type: [EolReleaseDto] })
  releases!: EolReleaseDto[];
}
