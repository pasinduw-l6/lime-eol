import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { authConfig, AuthConfig } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionDto } from './dto/auth.dto';

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  async sessionForExternalIdentity(
    email: string,
    displayName?: string,
  ): Promise<SessionDto> {
    const address = email.trim().toLowerCase();

    const existing = await this.prisma.appUser.findFirst({
      where: { email: { equals: address, mode: 'insensitive' } },
    });

    const user =
      existing ??
      (await this.prisma.appUser.create({
        data: {
          email: address,
          displayName: displayName ?? null,
          role: Role.VIEWER,
        },
      }));

    const promote =
      user.role !== Role.ADMIN && this.config.bootstrapAdmins.includes(address);

    if (!user.isActive) {
      throw new UnauthorizedException(
        'That account is deactivated. Ask an administrator to restore it.',
      );
    }

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        role: promote ? Role.ADMIN : undefined,
        displayName: user.displayName ?? displayName ?? null,
      },
    });

    const name = user.displayName ?? displayName ?? user.email;

    return {
      token: this.jwt.sign(
        { sub: user.id, email: user.email, role: promote ? Role.ADMIN : user.role },
        { expiresIn: TOKEN_TTL_SECONDS },
      ),
      id: user.id,
      email: user.email,
      displayName: name,
      role: promote ? Role.ADMIN : user.role,
      initials: initialsOf(name),
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async previewAccounts() {
    if (!this.config.previewLogin) {
      return { enabled: false, users: [] };
    }

    const users = await this.prisma.appUser.findMany({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });

    return {
      enabled: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.displayName ?? u.email,
        email: u.email,
        role: u.role,
      })),
    };
  }

  async previewSession(userId: string): Promise<SessionDto> {
    if (!this.config.previewLogin) {
      throw new NotFoundException();
    }

    const user = await this.prisma.appUser.findFirst({ where: { id: userId, isActive: true } });
    if (!user) {
      throw new UnauthorizedException('That account is not active.');
    }

    const name = user.displayName ?? user.email;
    return {
      token: this.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: TOKEN_TTL_SECONDS },
      ),
      id: user.id,
      email: user.email,
      displayName: name,
      role: user.role,
      initials: initialsOf(name),
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
