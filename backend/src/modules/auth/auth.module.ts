import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from '../../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    // The signing key comes from the validated config namespace rather than
    // process.env, so a missing DEV_JWT_SECRET fails at startup, not at the
    // first sign-in attempt.
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.devJwtSecret ?? 'change-me',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    /**
     * Exactly one strategy, chosen by AUTH_MODE, both registered under the
     * passport name 'jwt'.
     *
     * Registering both would have them fight over the name. Choosing here
     * means the guards, and every controller, never learn where a token
     * came from: they read request.user.role and that is all.
     */
    {
      provide: 'AUTH_STRATEGY',
      inject: [authConfig.KEY, PrismaService],
      useFactory: (
        config: ConfigType<typeof authConfig>,
        prisma: PrismaService,
      ) =>
        config.mode === 'dev'
          ? new JwtStrategy(config)
          : new OidcStrategy(config, prisma),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
