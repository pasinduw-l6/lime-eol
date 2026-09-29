import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../public.decorator';
import { ROLES } from '../roles.decorator';

/**
 * Enforces @Roles.
 *
 * Registered globally, and a no-op on the routes that do not use the decorator
 * - which is nearly all of them. Being global is what matters: the operations
 * page is kept out of the navigation for tidiness, but the route name is in the
 * JavaScript bundle for anyone who looks, so hiding it protects nothing. This
 * does.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();

    const role = request.user?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException(
        'That is restricted to operations accounts.',
      );
    }

    return true;
  }
}
