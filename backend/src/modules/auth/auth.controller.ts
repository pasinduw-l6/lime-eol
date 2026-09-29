import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Optional,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { appConfig, AppConfig, authConfig, AuthConfig } from '../../config';
import { AuthService } from './auth.service';
import { LoginDto, SessionDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { SamlService } from './saml.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(appConfig.KEY) private readonly app: AppConfig,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    @Optional() private readonly saml?: SamlService,
  ) {}

  @Get('mode')
  @Public()
  @ApiOperation({
    summary: 'How this deployment expects people to sign in',
    description:
      'The sign-in page reads this to decide between a password form and a ' +
      'redirect to the identity provider, so the two can never disagree.',
  })
  mode(): { mode: string; ssoLoginPath: string | null } {
    return {
      mode: this.config.mode,
      ssoLoginPath:
        this.config.mode === 'saml' ? '/api/v1/auth/saml/login' : null,
    };
  }

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

  /**
   * Step one of a SAML sign-in: hand the browser off to Microsoft.
   *
   * `next` rides along as RelayState and comes back untouched on the assertion,
   * which is how a deep link survives the round trip.
   */
  @Get('saml/login')
  @Public()
  @ApiOperation({ summary: 'Redirect to the identity provider to sign in' })
  async samlLogin(
    @Res() response: Response,
    @Query('next') next?: string,
  ): Promise<void> {
    const url = await this.requireSaml().loginUrl(next ?? '');
    response.redirect(302, url);
  }

  /**
   * Step two: Microsoft POSTs the signed assertion here.
   *
   * This is a form POST made by the browser, not an API call, so the reply is a
   * redirect rather than JSON. The session travels in the URL fragment: a
   * fragment is never sent to a server, so it stays out of nginx's access log
   * and out of any Referer header, which a query string would not.
   */
  @Post('saml/acs')
  @Public()
  @ApiExcludeEndpoint()
  async samlAcs(
    @Body() body: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    const saml = this.requireSaml();
    const base = this.app.baseUrl.replace(/\/$/, '');

    try {
      const identity = await saml.identify(body);
      const session = await this.auth.sessionForExternalIdentity(
        identity.email,
        identity.displayName,
      );

      const payload = Buffer.from(JSON.stringify(session), 'utf8').toString(
        'base64url',
      );
      const next = saml.relayStateOf(body);

      response.redirect(
        302,
        `${base}/auth/callback#session=${payload}` +
          (next ? `&next=${encodeURIComponent(next)}` : ''),
      );
    } catch (error) {
      // The browser is mid-redirect, so an error page here is a dead end. Send
      // people back to the sign-in screen with something it can explain.
      const reason =
        error instanceof Error && error.message ? error.message : 'sso_failed';
      response.redirect(
        302,
        `${base}/login?error=${encodeURIComponent(reason)}`,
      );
    }
  }

  /**
   * Service provider metadata, so the enterprise application can be set up by
   * upload rather than by copying fields between two browser tabs.
   */
  @Get('saml/metadata')
  @Public()
  @Header('Content-Type', 'application/xml')
  @ApiOperation({ summary: 'SAML service provider metadata for this API' })
  samlMetadata(): string {
    return this.requireSaml().metadata();
  }

  private requireSaml(): SamlService {
    if (!this.saml) {
      throw new ServiceUnavailableException(
        'This deployment is not configured for SAML sign-in.',
      );
    }

    return this.saml;
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
