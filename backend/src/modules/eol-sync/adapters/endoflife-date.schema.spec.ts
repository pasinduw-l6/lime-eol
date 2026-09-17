import mongodbFixture from '../__fixtures__/mongodb.product.json';
import nodejsFixture from '../__fixtures__/nodejs.product.json';
import { productResponseSchema } from './endoflife-date.schema';

describe('endoflife.date response schema', () => {
  it('accepts a real Node.js response', () => {
    const parsed = productResponseSchema.parse(nodejsFixture);

    expect(parsed.result.name).toBe('nodejs');
    expect(parsed.result.releases.length).toBeGreaterThan(0);

    const lts24 = parsed.result.releases.find((r) => r.name === '24');
    expect(lts24).toBeDefined();
    expect(lts24?.isLts).toBe(true);
    expect(lts24?.eolFrom).toBe('2028-04-30');
    expect(lts24?.latest?.name).toMatch(/^24\./);
  });

  it('accepts a real MongoDB response with major.minor cycles', () => {
    const parsed = productResponseSchema.parse(mongodbFixture);

    expect(parsed.result.category).toBe('database');
    expect(parsed.result.releases.map((r) => r.name)).toContain('6.0');
  });

  it('tolerates unknown properties added upstream', () => {
    const withExtras = {
      ...nodejsFixture,
      somethingNew: true,
      result: { ...nodejsFixture.result, alsoNew: 'value' },
    };

    expect(() => productResponseSchema.parse(withExtras)).not.toThrow();
  });

  it('rejects a malformed date rather than storing it', () => {
    const broken = {
      ...nodejsFixture,
      result: {
        ...nodejsFixture.result,
        releases: [{ name: '24', eolFrom: 'next year' }],
      },
    };

    expect(() => productResponseSchema.parse(broken)).toThrow();
  });

  it('rejects a response missing the envelope', () => {
    expect(() => productResponseSchema.parse({ name: 'nodejs' })).toThrow();
  });
});
