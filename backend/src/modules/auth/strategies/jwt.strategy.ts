import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig, AuthConfig } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  purpose?: 'report';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY) config: AuthConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.sessionSecret,
    });
  }

  async validate(claims: JwtClaims) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        roleRef: { select: { permissions: true, pages: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('That account is no longer active.');
    }

    if (claims.purpose === 'report') {
      return { id: user.id, email: user.email, role: 'VIEWER', permissions: [], pages: user.roleRef.pages };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.roleRef.permissions,
      pages: user.roleRef.pages,
    };
  }
}
