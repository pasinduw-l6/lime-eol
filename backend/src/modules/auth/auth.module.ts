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
