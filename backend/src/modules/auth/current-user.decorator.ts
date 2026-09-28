import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Whatever the active strategy put on the request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/**
 * The signed-in account, from the verified token.
 *
 * This replaced an `x-acting-user` header the client set itself. That header
 * decided `recordedById` on the change history — the hash-chained record the
 * whole verification story rests on — so anyone could attribute a version
 * change to anyone else, and the chain would preserve the lie faithfully.
 *
 * Safe to treat as present: the global JwtAuthGuard rejects anonymous callers
 * before a handler runs, so only a @Public() route could see this undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
