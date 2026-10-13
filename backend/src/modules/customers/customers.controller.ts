import { AccessService } from '../access/access.service';
import { Scope } from '../access/scope.decorator';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { CustomerAgreementsService } from './customer-agreements.service';
import { CustomersService } from './customers.service';
import {
  CreateAgreementDto,
  CreateContactDto,
  UpdateAgreementDto,
  UpdateContactDto,
} from './dto/agreement.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly agreements: CustomerAgreementsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Customers with their current agreement and primary contact' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const [visible, list] = await Promise.all([this.access.visibleCustomerIds(user.id), this.customers.findAll()]);
    return visible === null ? list : list.filter((c) => visible.includes(c.id));
  }

  @Get('archived')
  @ApiOperation({ summary: 'Archived customers' })
  async archived(@CurrentUser() user: AuthenticatedUser) {
    const [visible, list] = await Promise.all([this.access.visibleCustomerIds(user.id), this.customers.findArchived()]);
    return visible === null ? list : list.filter((c) => visible.includes(c.id));
  }

  @Get(':id')
  @Scope('customer')
  @ApiOperation({ summary: 'One customer with every agreement and contact' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customers.findOne(id);
  }

  @Post()
  @Scope('global')
  @Can('customer:write')
  @ApiOperation({ summary: 'Add a customer' })
  create(@Body() body: CreateCustomerDto) {
    return this.customers.create(body);
  }

  @Patch(':id')
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Change a customer' })
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(id, body);
  }

  @Delete(':id')
  @Scope('customer')
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
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Restore an archived customer' })
  restore(@Param('id') id: string) {
    return this.customers.restore(id);
  }

  @Post(':id/agreements')
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Add an agreement: full, detailed or license' })
  createAgreement(
    @Param('id') id: string,
    @Body() body: CreateAgreementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agreements.createAgreement(id, body);
  }

  @Patch(':id/agreements/:agreementId')
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Change an agreement' })
  updateAgreement(
    @Param('id') id: string,
    @Param('agreementId') agreementId: string,
    @Body() body: UpdateAgreementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agreements.updateAgreement(id, agreementId, body);
  }

  @Delete(':id/agreements/:agreementId')
  @Scope('customer')
  @Can('customer:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an agreement entered by mistake' })
  deleteAgreement(@Param('id') id: string, @Param('agreementId') agreementId: string): Promise<void> {
    return this.agreements.deleteAgreement(id, agreementId);
  }

  @Post(':id/contacts')
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Add a contact' })
  createContact(@Param('id') id: string, @Body() body: CreateContactDto) {
    return this.agreements.createContact(id, body);
  }

  @Patch(':id/contacts/:contactId')
  @Scope('customer')
  @Can('customer:write')
  @ApiOperation({ summary: 'Change a contact or make them primary' })
  updateContact(@Param('id') id: string, @Param('contactId') contactId: string, @Body() body: UpdateContactDto) {
    return this.agreements.updateContact(id, contactId, body);
  }

  @Delete(':id/contacts/:contactId')
  @Scope('customer')
  @Can('customer:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a contact' })
  deleteContact(@Param('id') id: string, @Param('contactId') contactId: string): Promise<void> {
    return this.agreements.deleteContact(id, contactId);
  }
}
