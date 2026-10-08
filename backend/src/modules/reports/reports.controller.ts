import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { ReportKind, ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('project/:id.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'The Overview of one project as a PDF' })
  project(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    return this.send('project', id, user, res);
  }

  @Get('customer/:id.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'A customer report: a summary page, then every project' })
  customer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    return this.send('customer', id, user, res);
  }

  private async send(kind: ReportKind, id: string, user: AuthenticatedUser, res: Response) {
    const { file, name } = await this.reports.render(kind, id, user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Length', String(file.length));
    res.end(file);
  }
}
