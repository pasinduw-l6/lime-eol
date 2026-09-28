import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, SessionDto } from './dto/auth.dto';
import { verifyPassword } from './password.util';

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto): Promise<SessionDto> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.appUser.findUnique({ where: { email } });

    const matches = await verifyPassword(input.password, user?.passwordHash ?? null);

    if (!user || !matches) {
      throw new UnauthorizedException('That email and password do not match.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'That account is deactivated. Ask an administrator to restore it.',
      );
    }

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const displayName = user.displayName ?? user.email;

    return {
      token: this.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: TOKEN_TTL_SECONDS },
      ),
      id: user.id,
      email: user.email,
      displayName,
      role: user.role,
      initials: initialsOf(displayName),
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.appUser.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('That session is no longer valid.');
    }

    const displayName = user.displayName ?? user.email;

    return {
      id: user.id,
      email: user.email,
      displayName,
      role: user.role as Role,
      initials: initialsOf(displayName),
    };
  }
}

function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
