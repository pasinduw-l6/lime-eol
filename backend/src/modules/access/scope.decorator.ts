import { SetMetadata } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import { ScopeKind } from './access.service';

export const SCOPE = 'project-scope';

export interface ScopeMeta {
  kind: ScopeKind;
  from: string;
  level?: AccessLevel;
}

export const Scope = (kind: ScopeKind, from = 'params.id', level?: AccessLevel) =>
  SetMetadata(SCOPE, { kind, from, level } satisfies ScopeMeta);
