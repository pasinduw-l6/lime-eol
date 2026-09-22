import { Module } from '@nestjs/common';
import { TechnologiesController } from './technologies.controller';

@Module({
  controllers: [TechnologiesController],
})
export class TechnologiesModule {}
