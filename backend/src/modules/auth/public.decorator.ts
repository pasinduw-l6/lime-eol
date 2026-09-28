import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Opens one route to unauthenticated callers.
 *
 * Authentication is on by default for the whole API, so this is the only way
 * in. Deliberately an opt-out rather than an opt-in: a new endpoint that
 * nobody remembered to annotate should be closed, not open, which is the way
 * round this API had it before.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
