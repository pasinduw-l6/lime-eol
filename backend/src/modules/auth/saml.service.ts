import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SAML } from '@node-saml/node-saml';
import { authConfig, AuthConfig } from '../../config';

export interface SamlIdentity {
  email: string;
  displayName?: string;
}

/**
 * The SAML half of AUTH_MODE=saml.
 *
 * Deliberately not a Passport strategy. SAML only has to answer "who is this"
 * once, at sign-in; every request after that carries the API's own bearer token
 * and is checked by JwtStrategy exactly as in dev mode. Driving node-saml
 * directly keeps that boundary visible and avoids threading a browser redirect
 * through a guard.
 */
@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly saml: SAML;

  constructor(@Inject(authConfig.KEY) config: AuthConfig) {
    const saml = config.saml;

    if (!saml) {
      throw new Error(
        'AUTH_MODE=saml needs SAML_ENTRY_POINT, SAML_CERT, SAML_SP_ENTITY_ID and SAML_SESSION_SECRET.',
      );
    }

    this.saml = new SAML({
      entryPoint: saml.entryPoint,
      issuer: saml.spEntityId,
      callbackUrl: saml.callbackUrl,
      idpCert: saml.idpCert,
      idpIssuer: saml.idpIssuer,
      audience: saml.spEntityId,
      identifierFormat:
        'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      // Entra signs the assertion rather than the whole response, and rejects
      // a request that asks for a specific authentication context.
      wantAuthnResponseSigned: false,
      wantAssertionsSigned: true,
      disableRequestedAuthnContext: true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      // Five minutes of tolerance for clock drift between here and Microsoft.
      acceptedClockSkewMs: 5 * 60 * 1000,
    });
  }

  /**
   * Where to send the browser to sign in. `relayState` comes back untouched on
   * the assertion, which is how the originally requested page survives the
   * round trip through Microsoft.
   */
  loginUrl(relayState = ''): Promise<string> {
    return this.saml.getAuthorizeUrlAsync(relayState, undefined, {});
  }

  /**
   * Validates the assertion Entra POSTed and pulls an email address out of it.
   *
   * Everything about trusting this request happens inside
   * validatePostResponseAsync: the XML signature against the IdP certificate,
   * the issuer, the audience, and the assertion's own validity window. If any
   * of that fails it throws, and we say nothing specific to the caller.
   */
  async identify(body: Record<string, unknown>): Promise<SamlIdentity> {
    let profile: Record<string, unknown> | null = null;

    try {
      const result = await this.saml.validatePostResponseAsync(
        body as { SAMLResponse: string; RelayState?: string },
      );
      profile = (result.profile ?? null) as Record<string, unknown> | null;
    } catch (error) {
      this.logger.warn(
        `Rejected a SAML assertion: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new UnauthorizedException('That sign-in could not be verified.');
    }

    if (!profile) {
      throw new UnauthorizedException('That sign-in carried no assertion.');
    }

    const email = pick(profile, [
      'email',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      'nameID',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ]);

    if (!email || !email.includes('@')) {
      throw new UnauthorizedException(
        'That sign-in carried no email address, so it cannot be matched to an account.',
      );
    }

    const displayName =
      pick(profile, [
        'http://schemas.microsoft.com/identity/claims/displayname',
        'displayName',
      ]) ??
      joinNames(
        pick(profile, [
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        ]),
        pick(profile, [
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        ]),
      );

    return { email: email.trim().toLowerCase(), displayName };
  }

  /**
   * Service provider metadata, so the enterprise application can be configured
   * by upload instead of by copying four fields by hand.
   */
  metadata(): string {
    return this.saml.generateServiceProviderMetadata(null, null);
  }

  /** The RelayState Entra echoed back, used to resume the requested page. */
  relayStateOf(body: Record<string, unknown>): string {
    const value = body.RelayState;
    return typeof value === 'string' ? value : '';
  }
}

function pick(
  profile: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
      return value[0];
    }
  }

  return undefined;
}

function joinNames(
  first: string | undefined,
  last: string | undefined,
): string | undefined {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name === '' ? undefined : name;
}
