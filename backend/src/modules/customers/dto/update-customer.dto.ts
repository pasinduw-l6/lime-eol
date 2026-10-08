import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const COMMERCIAL_MODELS = ['SUBSCRIPTION', 'LICENSE'] as const;

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'Demo Bank' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ nullable: true, example: 'it-ops@demobank.lk' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  contact?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({
    enum: COMMERCIAL_MODELS,
    nullable: true,
    description:
      'SUBSCRIPTION: infrastructure upgrades are included for the contract period. LICENSE: upgrades are assessed and quoted separately.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(COMMERCIAL_MODELS)
  commercialModel?: (typeof COMMERCIAL_MODELS)[number] | null;

  @ApiPropertyOptional({ nullable: true, example: '2024-01-01' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  contractStart?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2028-12-31' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  contractEnd?: string | null;
}
