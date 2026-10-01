import { ApiProperty } from '@nestjs/swagger';

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
