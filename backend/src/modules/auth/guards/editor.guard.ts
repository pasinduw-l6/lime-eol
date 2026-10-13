import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAN } from '../can.decorator';
import { can, Permission } from '../permissions';
import { IS_PUBLIC } from '../public.decorator';

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class EditorGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      user?: { role?: string };
    }>();

    const explicit = this.reflector.getAllAndOverride<Permission[]>(CAN, targets);

    if (READ_ONLY.has(request.method) && !explicit) {
      return true;
    }

    const role = request.user?.role;
    if (!role) {
      throw new ForbiddenException('Not signed in.');
    }

    const required = explicit ?? ['estate:write'];

    if (!required.some((permission) => can(role, permission))) {
      throw new ForbiddenException('Your role does not allow that change.');
    }

    return true;
  }
}
