import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { CompatibilityDto, CreateLimeReleaseDto, UpdateLimeReleaseDto } from './lime-releases.dto';
import { LimeReleasesService } from './lime-releases.service';

@ApiTags('lime-releases')
@Controller('lime-releases')
export class LimeReleasesController {
  constructor(private readonly releases: LimeReleasesService) {}

  @Get()
  @ApiOperation({ summary: 'Lime releases with their support window and compatible versions' })
  findAll() {
    return this.releases.findAll();
  }

  @Get('options')
  @ApiOperation({ summary: 'Technology versions that can be marked compatible' })
  options() {
    return this.releases.options();
  }

  @Post()
  @Can('lime:write')
  @ApiOperation({ summary: 'Add a Lime release', description: 'Support defaults to four years after release.' })
  create(@Body() body: CreateLimeReleaseDto) {
    return this.releases.create(body);
  }

  @Patch(':id')
  @Can('lime:write')
  @ApiOperation({ summary: 'Change a Lime release' })
  update(@Param('id') id: string, @Body() body: UpdateLimeReleaseDto) {
    return this.releases.update(id, body);
  }

  @Put(':id/compatibility')
  @Can('lime:write')
  @ApiOperation({ summary: 'Replace the technology versions a release supports' })
  setCompatibility(@Param('id') id: string, @Body() body: CompatibilityDto) {
    return this.releases.setCompatibility(id, body.techVersionIds);
  }

  @Delete(':id')
  @Can('lime:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a Lime release', description: 'Refused while any project uses it.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.releases.remove(id);
  }
}
