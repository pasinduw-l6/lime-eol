import { Module } from '@nestjs/common';
import { UpgradeActionsController } from './upgrade-actions.controller';
import { UpgradeActionsService } from './upgrade-actions.service';

@Module({
  controllers: [UpgradeActionsController],
  providers: [UpgradeActionsService],
  exports: [UpgradeActionsService],
})
export class UpgradeActionsModule {}
