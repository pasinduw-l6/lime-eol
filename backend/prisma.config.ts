import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma configuration.
 *
 * Replaces the `prisma` key in package.json, which is deprecated in 6.x and
 * removed in Prisma 7.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed/seed.ts',
  },
});
