import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class SetOwnersDto {
  @ApiProperty({ type: [String], description: 'Teams owning the environment; the first is primary' })
  @IsArray()
  @IsUUID('all', { each: true })
  teamIds!: string[];
}
