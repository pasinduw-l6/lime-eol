import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Can } from '../auth/can.decorator';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Every role with its permissions, pages and number of people' })
  findAll() {
    return this.roles.findAll();
  }

  @Get('catalogue')
  @ApiOperation({ summary: 'The permissions and pages a role can be given' })
  catalogue() {
    return this.roles.catalogue();
  }

  @Post()
  @Can('admin')
  @ApiOperation({ summary: 'Create a role' })
  create(@Body() body: CreateRoleDto) {
    return this.roles.create(body);
  }

  @Patch(':key')
  @Can('admin')
  @ApiOperation({ summary: 'Change a role. Takes effect on each person’s next request.' })
  update(@Param('key') key: string, @Body() body: UpdateRoleDto) {
    return this.roles.update(key, body);
  }

  @Delete(':key')
  @Can('admin')
  @HttpCode(204)
  @ApiQuery({ name: 'moveTo', required: false, description: 'Role to give the people who had this one' })
  @ApiOperation({ summary: 'Delete a custom role' })
  remove(@Param('key') key: string, @Query('moveTo') moveTo?: string): Promise<void> {
    return this.roles.remove(key, moveTo);
  }
}
