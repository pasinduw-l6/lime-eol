import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { AuthConfig } from '../../config';

export interface OidcIdentity {
  email: string;
  displayName?: string;
}

interface StateClaims {
  typ: 'oidc-state';
  nonce: string;
  next: string;
}

interface IdTokenClaims {
  nonce?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
}

const STATE_TTL = '10m';

/**
 * Microsoft sign-in by the authorization code flow.
 *
 * The browser is sent to Microsoft, comes back to this API with a code, and the
 * API exchanges that code for tokens over a back channel using the client
 * secret. The user's browser never sees a Microsoft token - it only ever
 * receives this app's own session, the same one the password login issues.
 */
@Injectable()
export class OidcWebService {
  private readonly logger = new Logger(OidcWebService.name);
  private readonly jwks: JwksClient;

  constructor(
    private readonly config: NonNullable<AuthConfig['oidcWeb']>,
    private readonly jwt: JwtService,
  ) {
    this.jwks = new JwksClient({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxAge: 12 * 60 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  /**
   * Where to send the browser to sign in.
   *
   * `state` is a short-lived signed token rather than a random string kept in a
   * server-side session. It carries the page the person was heading for and the
   * nonce the id_token must echo back, which means the API stays stateless and
   * survives a restart mid-sign-in.
   */
  loginUrl(next = ''): string {
    const nonce = randomBytes(16).toString('base64url');

    const state = this.jwt.sign(
      { typ: 'oidc-state', nonce, next } satisfies StateClaims,
      { expiresIn: STATE_TTL },
    );

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      response_mode: 'query',
      scope: 'openid profile email',
      state,
      nonce,
    });

    return `${this.config.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Turns the code Microsoft sent back into an identity.
   *
   * Three things are checked, and a failure of any one of them is a refusal:
   * the state is one we issued and has not expired, the id_token is genuinely
   * signed by the tenant and meant for this client, and the nonce inside it
   * matches the one that went out with the request. The last of those is what
   * stops a token obtained elsewhere being replayed here.
   */
  async identify(
    code: string,
    state: string,
  ): Promise<{ identity: OidcIdentity; next: string }> {
    const claims = this.verifyState(state);
    const idToken = await this.exchange(code);
    const verified = await this.verifyIdToken(idToken);

    if (!verified.nonce || verified.nonce !== claims.nonce) {
      throw new UnauthorizedException('That sign-in could not be verified.');
    }

    const email = (
      verified.email ??
      verified.preferred_username ??
      verified.upn ??
      ''
    )
      .trim()
      .toLowerCase();

    if (!email.includes('@')) {
      throw new UnauthorizedException(
        'That sign-in carried no email address, so it cannot be matched to an account.',
      );
    }

    return {
      identity: { email, displayName: verified.name },
      next: claims.next,
    };
  }

  private verifyState(state: string): StateClaims {
    let claims: StateClaims;

    try {
      claims = this.jwt.verify<StateClaims>(state);
    } catch {
      throw new UnauthorizedException(
        'That sign-in took too long or was not started here. Please try again.',
      );
    }

    // Without this, any session token this API has issued would also pass as
    // state - they are signed with the same key.
    if (claims.typ !== 'oidc-state') {
      throw new UnauthorizedException('That sign-in could not be verified.');
    }

    return claims;
  }

  private async exchange(code: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      scope: 'openid profile email',
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !payload.id_token) {
      // error_description is where Entra explains a redirect_uri mismatch or an
      // expired secret, and those are the two things that actually go wrong.
      this.logger.warn(
        `Token exchange refused: ${payload.error ?? response.status} ${payload.error_description ?? ''}`.trim(),
      );
      throw new UnauthorizedException('That sign-in could not be completed.');
    }

    return payload.id_token;
  }

  private async verifyIdToken(token: string): Promise<IdTokenClaims> {
    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      this.jwks
        .getSigningKey(header.kid)
        .then((key) => callback(null, key.getPublicKey()))
        .catch((error: Error) => callback(error));
    };

    return new Promise<IdTokenClaims>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: this.config.clientId,
          issuer: this.config.issuer,
          algorithms: ['RS256'],
          clockTolerance: 300,
        },
        (error, decoded) => {
          if (error || !decoded || typeof decoded === 'string') {
            this.logger.warn(
              `Rejected an id_token: ${error?.message ?? 'unreadable'}`,
            );
            reject(
              new UnauthorizedException('That sign-in could not be verified.'),
            );
            return;
          }

          resolve(decoded as IdTokenClaims);
        },
      );
    });
  }
}
