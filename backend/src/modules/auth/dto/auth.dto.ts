import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'pasinduw@linearsix.com' })
  @IsString()
  @MinLength(1, { message: 'Enter your work email.' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'yl123' })
  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(200)
  password!: string;
}

export class SessionDto {
  @ApiProperty({ description: 'Bearer token for subsequent requests' })
  token!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: ['ADMIN', 'EDITOR', 'VIEWER'] })
  role!: string;

  @ApiProperty({ description: 'Two letters, for the header avatar' })
  initials!: string;

  @ApiProperty({ description: 'When this session expires, ISO 8601' })
  expiresAt!: string;
}
