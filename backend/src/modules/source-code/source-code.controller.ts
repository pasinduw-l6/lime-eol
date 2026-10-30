import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { Can } from '../auth/can.decorator';
import { SourceCodeService } from './source-code.service';

class SaveSourceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  repo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  prodBranch!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  devBranch?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  dockerfilePath?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  packagePath?: string | null;
}

class RemindDto {
  @IsIn([2, 12, 24, 72, 168])
  hours!: number;
}

@ApiTags('source-code')
@Controller('source-code')
export class SourceCodeController {
  constructor(private readonly source: SourceCodeService) {}

  @Get()
  @Can('integration:write')
  @ApiOperation({ summary: 'The GitHub App connection and every project linked to a repository' })
  status() {
    return this.source.status();
  }

  @Get('repos')
  @Can('integration:write')
  @ApiOperation({ summary: 'Repositories the GitHub App can read' })
  repos() {
    return this.source.repos();
  }

  @Get('branches')
  @Can('integration:write')
  @ApiOperation({ summary: 'Branches of one repository' })
  branches(@Query('repo') repo: string) {
    return this.source.branches(repo);
  }

  @Put('projects/:projectId')
  @Can('integration:write')
  @ApiOperation({ summary: 'Link a project to its repository and branches, then read its versions' })
  save(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: SaveSourceDto) {
    return this.source.save(projectId, body);
  }

  @Delete('projects/:projectId')
  @Can('integration:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop reading versions from GitHub for a project' })
  remove(@Param('projectId', ParseUUIDPipe) projectId: string): Promise<void> {
    return this.source.remove(projectId);
  }

  @Post('scan')
  @Can('integration:write')
  @ApiOperation({ summary: 'Read every linked repository now' })
  async scan() {
    await this.source.scanAll();
    return this.source.status();
  }

  @Get('proposals')
  @Can('integration:write')
  @ApiOperation({ summary: 'New versions from GitHub waiting for approval (or decided ones with ?status=APPROVED)' })
  proposals(@Query('status') status?: string) {
    return this.source.proposals(status === 'APPROVED' ? 'APPROVED' : 'PENDING');
  }

  @Post('proposals/:id/approve')
  @Can('estate:write')
  @ApiOperation({ summary: 'Approve a new version: it is recorded on the project (Admin and SRE)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.source.approve(id, user.id);
  }

  @Post('proposals/:id/remind')
  @Can('estate:write')
  @ApiOperation({ summary: 'Not yet: remind the Teams channel after 2, 12, 24, 72 or 168 hours, and again at that interval' })
  remind(@Param('id', ParseUUIDPipe) id: string, @Body() body: RemindDto) {
    return this.source.remindLater(id, body.hours);
  }
}
