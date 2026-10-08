import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'SRE / DevOps' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'sre@linearsix.com' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'The complete member list' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  memberIds?: string[];
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
