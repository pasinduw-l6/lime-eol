import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const AGREEMENT_TYPES = ['SUBSCRIPTION', 'LICENSE'] as const;
export const INFRA_COVERAGE = ['INCLUDED', 'QUOTED'] as const;

export class CreateAgreementDto {
  @ApiProperty({
    enum: AGREEMENT_TYPES,
    description:
      'Subscription: infrastructure upgrades included for the term, application dependencies through Lime releases. ' +
      'License: infrastructure per agreement, application dependencies assessed separately.',
  })
  @IsIn(AGREEMENT_TYPES)
  type!: (typeof AGREEMENT_TYPES)[number];

  @ApiPropertyOptional({
    enum: INFRA_COVERAGE,
    nullable: true,
    description: 'License only: whether infrastructure upgrades are included under this agreement',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(INFRA_COVERAGE)
  infrastructure?: (typeof INFRA_COVERAGE)[number] | null;

  @ApiPropertyOptional({ nullable: true, example: 50, description: 'License only: licensed users' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  licensedUsers?: number | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-01-01' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  startDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2030-12-31' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  endDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  renewalDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 90 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(730)
  noticeDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({ nullable: true, example: 2 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  upgradesPerYear?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Standard' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(60)
  supportLevel?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'PO-2026-114' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  documentUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateAgreementDto extends PartialType(CreateAgreementDto) {}

export class CreateContactDto {
  @ApiProperty({ example: 'Nimal Perera' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'IT Manager' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  role?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Receives end-of-life notices' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}
