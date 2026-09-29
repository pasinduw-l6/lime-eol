import { SetMetadata } from '@nestjs/common';

export const ROLES = 'roles';

/**
 * Restricts a route to particular roles.
 *
 * Without this a route is open to anyone signed in, which is the right default
 * for a registry six people share. Put it on anything that acts on behalf of
 * the whole team rather than on the estate - posting to the channel, clearing
 * what has already been announced.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);
