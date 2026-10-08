import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLES } from '../../auth/permissions';

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
