import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from '../../config';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcWebService } from './oidc-web.service';
import { SamlService } from './saml.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.sessionSecret ?? 'change-me',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      // Only built when SAML is the configured mode: the constructor refuses to
      // run without the SAML_* settings, which is the behaviour we want at boot
      // rather than on the first sign-in attempt.
      provide: SamlService,
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) =>
        config.mode === 'saml' ? new SamlService(config) : undefined,
    },
    {
      // Same shape as SamlService: built only when it is the configured mode,
      // so a missing setting fails at boot rather than on someone's first
      // attempt to sign in.
      provide: OidcWebService,
      inject: [authConfig.KEY, JwtService],
      useFactory: (config: ConfigType<typeof authConfig>, jwt: JwtService) =>
        config.mode === 'oidc-web' && config.oidcWeb
          ? new OidcWebService(config.oidcWeb, jwt)
          : undefined,
    },
    {
      provide: 'AUTH_STRATEGY',
      inject: [authConfig.KEY, PrismaService],
      useFactory: (
        config: ConfigType<typeof authConfig>,
        prisma: PrismaService,
      ) =>
        // dev, saml and oidc-web all leave the API holding its own bearer
        // token, so all three verify requests the same way. entra and oidc hand
        // the provider's own token to the API on every request, which is a
        // different check entirely.
        config.mode === 'entra' || config.mode === 'oidc'
          ? new OidcStrategy(config, prisma)
          : new JwtStrategy(config),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
