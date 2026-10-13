import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const WRITES: Record<string, string> = {
  POST: 'create',
  PATCH: 'update',
  PUT: 'update',
  DELETE: 'archive',
};

const SECRET_FIELD = /secret|password|webhook|apiToken|accessToken|^token$/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SECRET_FIELD.test(key) && inner ? '[redacted]' : redact(inner),
      ]),
    );
  }
  return value;
}

interface AuditedRequest {
  method: string;
  body?: unknown;
  params?: Record<string, string>;
  route?: { path?: string };
  user?: { id?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const verb = WRITES[request.method];

    if (!verb || !request.user?.id) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        void this.record(request, verb, response);
      }),
    );
  }

  private async record(request: AuditedRequest, verb: string, response: unknown): Promise<void> {
    const path = (request.route?.path ?? '').replace(/^\/?api\/v1\//, '').replace(/^\//, '');
    const [entity, ...rest] = path.split('/');
    const tail = rest.filter((part) => !part.startsWith(':')).join(' ');
    const params = request.params ?? {};
    const responseId =
      response && typeof response === 'object' && 'id' in response
        ? String((response as { id: unknown }).id)
        : null;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: request.user?.id ?? null,
          entity: entity || 'unknown',
          entityId: params['id'] ?? params['cycleId'] ?? responseId,
          action: tail ? `${verb} ${tail}` : verb,
          afterData: (redact(request.body) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not write the audit entry: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
