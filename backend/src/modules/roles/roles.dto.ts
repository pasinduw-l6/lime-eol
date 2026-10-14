import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Customer liaison' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Sends customer notices and logs assessments' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiProperty({ type: [String], example: ['plan:notice', 'plan:assess'] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  permissions!: string[];

  @ApiProperty({ type: [String], example: ['overview', 'plan', 'calendar'] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  pages!: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
