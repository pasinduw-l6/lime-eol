import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Customers with their commercial model and contract period' })
  findAll() {
    return this.customers.findAll();
  }

  @Get('archived')
  @ApiOperation({ summary: 'Archived customers' })
  archived() {
    return this.customers.findArchived();
  }

  @Post()
  @Can('customer:write')
  @ApiOperation({ summary: 'Add a customer' })
  create(@Body() body: CreateCustomerDto) {
    return this.customers.create(body);
  }

  @Patch(':id')
  @Can('customer:write')
  @ApiOperation({
    summary: 'Change a customer',
    description: 'The commercial model decides whether an upgrade is included or quoted.',
  })
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(id, body);
  }

  @Delete(':id')
  @Can('customer:write')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archive a customer',
    description: 'Refused while the customer still has active projects.',
  })
  archive(@Param('id') id: string): Promise<void> {
    return this.customers.archive(id);
  }

  @Post(':id/restore')
  @Can('customer:write')
  @ApiOperation({ summary: 'Restore an archived customer' })
  restore(@Param('id') id: string) {
    return this.customers.restore(id);
  }
}
