import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from '../../config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcWebService } from './oidc-web.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(authConfig)],
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        secret: config.sessionSecret,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: OidcWebService,
      inject: [authConfig.KEY, JwtService],
      useFactory: (config: ConfigType<typeof authConfig>, jwt: JwtService) =>
        new OidcWebService(config.oidcWeb, jwt),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
