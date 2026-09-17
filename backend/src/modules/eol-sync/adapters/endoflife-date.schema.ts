import { z } from 'zod';

/**
 * Wire format of endoflife.date API v1 (schema_version 1.2.x).
 *
 * The API is Beta, so every response is validated before use: an unexpected
 * shape must fail loudly during sync rather than silently write nulls over
 * good EOL dates. Unknown properties are ignored, so additive changes upstream
 * do not break us.
 */

/** ISO date, date-only: "2028-04-30". */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const nullableDate = isoDate.nullable().default(null);
const nullableBool = z.boolean().nullable().default(null);

export const releaseSchema = z.object({
  name: z.union([z.string(), z.number()]).transform(String),
  codename: z.string().nullable().default(null),
  label: z.string().default(''),
  releaseDate: nullableDate,
  isLts: z.boolean().default(false),
  ltsFrom: nullableDate,
  isEoas: nullableBool,
  eoasFrom: nullableDate,
  isEol: nullableBool,
  eolFrom: nullableDate,
  isEoes: nullableBool,
  eoesFrom: nullableDate,
  isMaintained: z.boolean().default(false),
  latest: z
    .object({
      name: z.union([z.string(), z.number()]).transform(String),
      date: nullableDate,
      link: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export const productSummarySchema = z.object({
  name: z.string(),
  label: z.string().default(''),
  category: z.string().default('other'),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const productSchema = productSummarySchema.extend({
  labels: z.record(z.string(), z.string().nullable()).default({}),
  links: z
    .object({
      html: z.string().nullable().default(null),
      releasePolicy: z.string().nullable().default(null),
    })
    .partial()
    .default({}),
  releases: z.array(releaseSchema).default([]),
});

/** Every v1 response wraps its payload in this envelope. */
export function envelopeSchema<T extends z.ZodTypeAny>(result: T) {
  return z.object({
    schema_version: z.string(),
    generated_at: z.string(),
    last_modified: z.string().optional(),
    total: z.number().optional(),
    result,
  });
}

export const productResponseSchema = envelopeSchema(productSchema);
export const productListResponseSchema = envelopeSchema(
  z.array(productSummarySchema),
);
export const releaseResponseSchema = envelopeSchema(releaseSchema);

export type RawRelease = z.infer<typeof releaseSchema>;
export type RawProduct = z.infer<typeof productSchema>;
export type RawProductSummary = z.infer<typeof productSummarySchema>;
