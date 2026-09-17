import { EolConfig } from '../../../config/namespaces/eol.config';
import nodejsFixture from '../__fixtures__/nodejs.product.json';
import {
  EndOfLifeDateClient,
  EolDataSourceError,
  EolProductNotFoundError,
} from './endoflife-date.client';

const config = {
  apiBase: 'https://endoflife.date/api/v1',
  syncCron: '0 2 * * *',
  syncOnStartup: false,
  approachingDays: 180,
  http: {
    timeoutMs: 50,
    retryAttempts: 2,
    retryBaseDelayMs: 1,
    requestDelayMs: 0,
    userAgent: 'test-agent',
  },
} as EolConfig;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('EndOfLifeDateClient', () => {
  let fetchMock: jest.Mock;
  let client: EndOfLifeDateClient;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new EndOfLifeDateClient(config);
  });

  it('requests the product endpoint and returns domain types', async () => {
    fetchMock.mockResolvedValue(jsonResponse(nodejsFixture));

    const product = await client.getProduct('nodejs');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://endoflife.date/api/v1/products/nodejs/',
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'test-agent' }),
      }),
    );
    expect(product.slug).toBe('nodejs');
    expect(product.releases[0]).toHaveProperty('cycle');
    expect(product.releases.find((r) => r.cycle === '24')?.eolFrom).toBe(
      '2028-04-30',
    );
  });

  it('caches a response instead of refetching', async () => {
    fetchMock.mockResolvedValue(jsonResponse(nodejsFixture));

    await client.getProduct('nodejs');
    await client.getProduct('nodejs');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 and succeeds on a later attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(nodejsFixture));

    const product = await client.getProduct('nodejs');

    expect(product.slug).toBe('nodejs');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured number of retries', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    await expect(client.getProduct('nodejs')).rejects.toBeInstanceOf(
      EolDataSourceError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(config.http.retryAttempts + 1);
  });

  it('does not retry an unknown product', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    await expect(client.getProduct('not-a-product')).rejects.toBeInstanceOf(
      EolProductNotFoundError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a client error that would fail identically', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 400));

    await expect(client.listProducts()).rejects.toBeInstanceOf(
      EolDataSourceError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a response whose shape changed upstream', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: { nope: true } }));

    await expect(client.getProduct('nodejs')).rejects.toThrow(
      /Unexpected response shape/,
    );
  });

  it('reports a timeout as a data source error', async () => {
    fetchMock.mockImplementation(() => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      return Promise.reject(abortError);
    });

    await expect(client.getProduct('nodejs')).rejects.toThrow(/timed out/);
  });

  it('returns null for a cycle the product does not publish', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));

    await expect(client.getRelease('nodejs', '99')).resolves.toBeNull();
  });
});
