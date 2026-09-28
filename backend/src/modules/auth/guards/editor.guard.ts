import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../public.decorator';

/** Methods that only read. Everything else changes something. */
const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Viewers may read the registry; they may not change it.
 *
 * The rule comes from the HTTP method rather than a decorator on each route.
 * Fifty-odd endpoints would each need annotating, and the way this kind of
 * check fails in practice is the one route nobody remembered — a method-based
 * rule cannot be forgotten, and a new mutating endpoint is protected the
 * moment it is written.
 *
 * Anything needing a finer rule than "editors may write" gets its own guard;
 * this is the floor, not the ceiling.
 */
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

    // JwtAuthGuard runs first and rejects anonymous callers, so a missing user
    // here means the guards are registered in the wrong order.
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
