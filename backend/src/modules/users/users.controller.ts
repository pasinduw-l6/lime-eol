import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Accounts, with their role, teams and staffing' })
  @ApiQuery({ name: 'all', required: false, description: 'Include deactivated accounts' })
  @ApiOkResponse({ description: 'Users ordered by name' })
  findAll(@Query('all') all?: string) {
    return this.users.findAll(all === 'true');
  }

  @Post()
  @Can('admin')
  @ApiOperation({
    summary: 'Add a person before they first sign in',
    description: 'They sign in with Microsoft as usual and get the role given here.',
  })
  invite(@Body() body: InviteUserDto) {
    return this.users.invite(body);
  }

  @Patch(':id')
  @Can('admin')
  @ApiOperation({
    summary: 'Change a role, a name, or deactivate',
    description: 'Takes effect on the person’s next request. The last active admin cannot be removed.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, body, actor.id);
  }
}
