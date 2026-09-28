import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

interface OidcClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
}

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
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: oidc.jwksUri,
        cache: true,
        cacheMaxAge: 12 * 60 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
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
      throw new UnauthorizedException(
        'That sign-in carried no email address, so it cannot be matched to an account.',
      );
    }

    const user = await this.prisma.appUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, role: true, displayName: true },
    });

    if (!user) {
      this.logger.log(`First sign-in for ${email} — granting viewer access.`);
      return { id: claims.sub, email, role: 'VIEWER' };
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
