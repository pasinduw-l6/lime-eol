import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from '../../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
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
      provide: 'AUTH_STRATEGY',
      inject: [authConfig.KEY, PrismaService],
      useFactory: (
        config: ConfigType<typeof authConfig>,
        prisma: PrismaService,
      ) =>
        // dev and saml both leave the API holding its own bearer token, so both
        // verify requests the same way. entra and oidc hand the provider's token
        // straight to the API, which is a different check entirely.
        config.mode === 'dev' || config.mode === 'saml'
          ? new JwtStrategy(config)
          : new OidcStrategy(config, prisma),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
