import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Customers with their commercial model and contract period' })
  findAll() {
    return this.customers.findAll();
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a customer',
    description: 'The commercial model decides whether an upgrade is included or quoted.',
  })
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(id, body);
  }
}
