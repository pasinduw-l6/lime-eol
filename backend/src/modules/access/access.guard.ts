import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from './access.service';
import { SCOPE, ScopeMeta } from './scope.decorator';

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<ScopeMeta>(SCOPE, [context.getHandler(), context.getClass()]);
    if (!meta) return true;

    const request = context.switchToHttp().getRequest<{
      method: string;
      user?: { id?: string };
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
    }>();
    if (!request.user?.id) return true;

    const [source, key] = meta.from.split('.') as ['params' | 'body', string];
    const value = (source === 'body' ? request.body : request.params)?.[key];
    const level = meta.level ?? (READ_ONLY.has(request.method) ? 'VIEW' : 'EDIT');

    await this.access.check(request.user.id, meta.kind, value, level);
    return true;
  }
}
