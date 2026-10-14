import { Scope } from '../access/scope.decorator';
import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('project/:id.pdf')
  @Scope('project')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'The Overview of one project as a PDF' })
  async project(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    send(res, 'application/pdf', await this.reports.render('project', id, user.id));
  }

  @Get('project/:id.docx')
  @Scope('project')
  @ApiProduces(DOCX)
  @ApiOperation({ summary: 'The same project report as an editable Word document' })
  async projectDocx(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    send(res, DOCX, await this.reports.renderDocx('project', id, user.id));
  }

  @Get('all.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Every project the caller can see, one section each' })
  async all(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    send(res, 'application/pdf', await this.reports.render('all', 'all', user.id));
  }

  @Get('all.docx')
  @ApiProduces(DOCX)
  @ApiOperation({ summary: 'The full report as an editable Word document' })
  async allDocx(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    send(res, DOCX, await this.reports.renderDocx('all', 'all', user.id));
  }
}

function send(res: Response, type: string, { file, name }: { file: Buffer; name: string }) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Length', String(file.length));
  res.end(file);
}
