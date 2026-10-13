import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerAgreementsService } from './customer-agreements.service';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerAgreementsService],
})
export class CustomersModule {}
