import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Claims we rely on, across providers.
 *
 * Entra puts the sign-in address in `preferred_username` and only sometimes
 * populates `email`; Keycloak populates `email`. Both are checked rather than
 * assuming one, because a missing address here means everyone silently drops
 * to viewer.
 */
interface OidcClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
}

/**
 * Sign-in delegated to an identity provider.
 *
 * Registered under the same passport name as the dev strategy, so the guards
 * never learn where a token came from — they read `request.user.role` either
 * way. Swapping providers is configuration.
 *
 * Deliberately generic rather than Entra-specific: the issuer and key set are
 * configuration, so the same code serves Entra or Keycloak. Only the URLs
 * differ, which is the whole reason this is not worth writing twice.
 *
 * What it does NOT do is trust the provider for authorisation. The token says
 * who someone is; this registry decides what they may do, by looking the
 * address up in its own user table. Anyone the provider will authenticate but
 * we do not know becomes a viewer — they can read, and change nothing.
 */
@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(OidcStrategy.name);

  constructor(
    config: AuthConfig,
    private readonly prisma: PrismaService,
  ) {
    const oidc = config.oidc;
    if (!oidc) {
      throw new Error(
        'AUTH_MODE expects an identity provider, but no issuer is configured.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Keys are fetched from the provider and cached. Rate limiting matters:
      // without it a burst of tokens signed by an unknown key would become a
      // burst of outbound requests.
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: oidc.jwksUri,
        cache: true,
        cacheMaxAge: 12 * 60 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
      // Both must be checked. A signature alone only proves the provider
      // issued the token — not that it was issued for this API.
      issuer: oidc.issuer,
      audience: oidc.audience,
      algorithms: ['RS256'],
    });
  }

  async validate(claims: OidcClaims) {
    const email = (
      claims.email ??
      claims.preferred_username ??
      claims.upn ??
      ''
    )
      .trim()
      .toLowerCase();

    if (!email) {
      // Better to refuse than to hand out a viewer session to a token we
      // cannot attribute to anyone.
      throw new UnauthorizedException(
        'That sign-in carried no email address, so it cannot be matched to an account.',
      );
    }

    const user = await this.prisma.appUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, role: true, displayName: true },
    });

    if (!user) {
      // Known to the directory, unknown to us: read-only. Matching on address
      // rather than the provider's own subject id is what lets the same user
      // table survive a change of tenant or provider.
      this.logger.log(`First sign-in for ${email} — granting viewer access.`);
      return { id: claims.sub, email, role: 'VIEWER' };
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
