import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { VersionFileController } from './version-file.controller';
import { VersionFileService } from './version-file.service';

@Module({
  imports: [DeploymentsModule],
  controllers: [VersionFileController],
  providers: [VersionFileService],
  exports: [VersionFileService],
})
export class VersionFileModule {}
