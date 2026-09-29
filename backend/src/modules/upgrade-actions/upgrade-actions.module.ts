import { Module } from '@nestjs/common';
import { IssueTrackerModule } from '../issue-tracker/issue-tracker.module';
import { UpgradeActionsController } from './upgrade-actions.controller';
import { UpgradeActionsService } from './upgrade-actions.service';

@Module({
  imports: [IssueTrackerModule],
  controllers: [UpgradeActionsController],
  providers: [UpgradeActionsService],
  exports: [UpgradeActionsService],
})
export class UpgradeActionsModule {}
