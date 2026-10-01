import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { appConfig, AppConfig } from '../../config';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { OidcWebService } from './oidc-web.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oidcWeb: OidcWebService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
  ) {}

  @Get('oidc/login')
  @Public()
  @ApiOperation({ summary: 'Redirect to Microsoft to sign in' })
  oidcLogin(@Res() response: Response, @Query('next') next?: string): void {
    response.redirect(302, this.oidcWeb.loginUrl(next ?? ''));
  }

  @Get('oidc/callback')
  @Public()
  @ApiExcludeEndpoint()
  async oidcCallback(
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<void> {
    const base = this.app.baseUrl.replace(/\/$/, '');

    const fail = (reason: string): void => {
      response.redirect(302, `${base}/login?error=${encodeURIComponent(reason)}`);
    };

    if (error) {
      fail(errorDescription || error);
      return;
    }

    if (!code || !state) {
      fail('That sign-in came back incomplete. Please try again.');
      return;
    }

    try {
      const { identity, next } = await this.oidcWeb.identify(code, state);
      const session = await this.auth.sessionForExternalIdentity(
        identity.email,
        identity.displayName,
      );

      const payload = Buffer.from(JSON.stringify(session), 'utf8').toString(
        'base64url',
      );

      response.redirect(
        302,
        `${base}/auth/callback#session=${payload}` +
          (next ? `&next=${encodeURIComponent(next)}` : ''),
      );
    } catch (thrown) {
      fail(
        thrown instanceof Error && thrown.message
          ? thrown.message
          : 'sso_failed',
      );
    }
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
