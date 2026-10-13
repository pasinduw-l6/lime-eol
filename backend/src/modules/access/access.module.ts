import { Global, Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { ProjectAccessGuard } from './access.guard';
import { AccessService } from './access.service';

@Global()
@Module({
  controllers: [AccessController],
  providers: [AccessService, ProjectAccessGuard],
  exports: [AccessService, ProjectAccessGuard],
})
export class AccessModule {}
