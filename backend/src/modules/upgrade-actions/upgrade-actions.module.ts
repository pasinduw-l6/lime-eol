import { Module } from '@nestjs/common';
import { UpgradeActionsController } from './upgrade-actions.controller';
import { ActionStepsService } from './action-steps.service';
import { UpgradeActionsService } from './upgrade-actions.service';

@Module({
  controllers: [UpgradeActionsController],
  providers: [UpgradeActionsService, ActionStepsService],
  exports: [UpgradeActionsService, ActionStepsService],
})
export class UpgradeActionsModule {}
