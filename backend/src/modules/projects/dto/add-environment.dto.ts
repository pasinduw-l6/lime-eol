import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { NewEnvironmentDto } from './create-project.dto';

export class AddEnvironmentDto extends NewEnvironmentDto {
  @ApiPropertyOptional({
    description: 'Environment of the same project whose components the new one starts with',
  })
  @IsOptional()
  @IsUUID()
  copyFrom?: string;
}
