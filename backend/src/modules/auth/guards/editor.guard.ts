import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../public.decorator';

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class EditorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      user?: { role?: string; email?: string };
    }>();

    if (READ_ONLY.has(request.method)) {
      return true;
    }

    const role = request.user?.role;
    if (!role) {
      throw new ForbiddenException('Not signed in.');
    }

    if (role === 'VIEWER') {
      throw new ForbiddenException(
        'Your account can view the registry but not change it.',
      );
    }

    return true;
  }
}
