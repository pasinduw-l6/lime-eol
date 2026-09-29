import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MessageFactDto {
  @ApiProperty({ example: 'Affected' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @ApiProperty({ example: 'NTB PROD, UB PROD' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value!: string;
}

export class MessageActionDto {
  @ApiProperty({ example: 'Open the registry' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ example: 'https://lime-eol.duckdns.org' })
  @IsUrl()
  url!: string;
}

export class CustomMessageDto {
  @ApiProperty({ example: 'Maintenance window Saturday 02:00–04:00' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'NTB and UB will be unavailable.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @ApiPropertyOptional({
    enum: ['critical', 'warning', 'info', 'good'],
    description: 'Drives the colour Teams paints down the side of the card.',
  })
  @IsOptional()
  @IsIn(['critical', 'warning', 'info', 'good'])
  severity?: 'critical' | 'warning' | 'info' | 'good';

  @ApiPropertyOptional({ type: [MessageFactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageFactDto)
  facts?: MessageFactDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Lines rendered under the facts, for anything the facts cannot hold.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lines?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Email addresses to tag. Leave empty for nobody; pass "everyone" to tag the whole team.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mention?: string[];

  @ApiPropertyOptional({ type: [MessageActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageActionDto)
  actions?: MessageActionDto[];
}
