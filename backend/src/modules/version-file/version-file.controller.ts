import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { VersionFileService } from './version-file.service';

@ApiTags('version-file')
@Controller('version-file')
export class VersionFileController {
  constructor(private readonly versions: VersionFileService) {}

  @Get()
  @ApiOperation({ summary: 'Where eol-versions.yml is read from and how the last sync went' })
  status() {
    return this.versions.status();
  }

  @Post('sync')
  @Can('integration:write')
  @ApiOperation({ summary: 'Read eol-versions.yml from GitHub now and record any version changes' })
  sync() {
    return this.versions.sync();
  }
}
