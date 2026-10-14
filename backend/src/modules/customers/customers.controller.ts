import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessService } from '../access/access.service';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Customers the caller can see. A customer is created with its first project.' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const [visible, list] = await Promise.all([this.access.visibleCustomerIds(user.id), this.customers.findAll()]);
    return visible === null ? list : list.filter((c) => visible.includes(c.id));
  }
}
