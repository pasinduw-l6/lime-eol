import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ROLES } from '../../auth/permissions';

export class ProjectGrant {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ enum: ['VIEW', 'EDIT'] })
  @IsIn(['VIEW', 'EDIT'])
  level!: 'VIEW' | 'EDIT';
}

export class InviteUserDto {
  @ApiProperty({ example: 'nimal@linearsix.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Nimal Perera' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];

  @ApiPropertyOptional({ enum: ['VIEW', 'EDIT'], nullable: true, description: 'Access to every project, now and later' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['VIEW', 'EDIT'])
  allProjects?: 'VIEW' | 'EDIT' | null;

  @ApiPropertyOptional({ type: [ProjectGrant] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectGrant)
  projects?: ProjectGrant[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];

  @ApiPropertyOptional({ description: 'False signs the person out on their next request' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
