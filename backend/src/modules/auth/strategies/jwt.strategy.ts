import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig, AuthConfig } from '../../../config';

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
}

/**
 * Validates the tokens this API issues.
 *
 * Only the local signing key: Entra tokens arrive with a different issuer and
 * are verified against its JWKS, which is a separate strategy for when
 * AUTH_MODE=entra lands.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(authConfig.KEY) config: AuthConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.devJwtSecret ?? 'change-me',
    });
  }

  validate(claims: JwtClaims) {
    // Whatever this returns becomes request.user.
    return { id: claims.sub, email: claims.email, role: claims.role };
  }
}
