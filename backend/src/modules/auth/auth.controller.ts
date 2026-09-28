import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SessionDto } from './dto/auth.dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({
    summary: 'Exchange an email and password for a session token',
    description:
      'Accounts are issued by an administrator; there is no self-service registration.',
  })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ description: 'Email and password do not match' })
  login(@Body() body: LoginDto): Promise<SessionDto> {
    return this.auth.login(body);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'The account behind the current token',
    description:
      'Read from the database, not the token, so a role change or deactivation takes effect immediately.',
  })
  me(@Req() request: { user: { id: string } }) {
    return this.auth.me(request.user.id);
  }
}
