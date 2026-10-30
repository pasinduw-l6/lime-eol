import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SourceCodeController } from './source-code.controller';
import { SourceCodeService } from './source-code.service';

@Module({
  imports: [DeploymentsModule, IntegrationsModule, NotificationsModule],
  controllers: [SourceCodeController],
  providers: [SourceCodeService],
  exports: [SourceCodeService],
})
export class SourceCodeModule {}
