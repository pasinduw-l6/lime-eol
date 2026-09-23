import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class SetEngineersDto {
  @ApiProperty({
    type: [String],
    description: 'Everyone staffed on the project, as the complete list',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  engineerIds!: string[];

  @ApiPropertyOptional({
    description: 'Who leads it. Defaults to the first in the list.',
  })
  @IsOptional()
  @IsUUID()
  leadId?: string;
}
