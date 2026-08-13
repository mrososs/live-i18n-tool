import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSaveMiddleware,
  type SaveMiddlewareOptions,
} from './save-middleware.js';
import { TranslationIndexer } from './translation-indexer.js';

const ENDPOINT = '/__live-i18n-update';
const DEFAULT_HEADERS = {
  'content-type': 'application/json',
  origin: 'http://localhost:4200',
  host: 'localhost:4200',
};

interface InvokeResult {
  status: number | 'next';
  body?: { ok?: boolean; error?: string; revision?: string };
}

function invoke(
  middleware: ReturnType<typeof createSaveMiddleware>,
  body: unknown,
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<InvokeResult> {
  const {
    method = 'POST',
    url = ENDPOINT,
    headers = DEFAULT_HEADERS,
  } = options;
  return new Promise((done) => {
    const req = Readable.from([
      Buffer.from(JSON.stringify(body)),
    ]) as unknown as IncomingMessage;
    (req as { method?: string }).method = method;
    (req as { url?: string }).url = url;
    (req as { headers: Record<string, string> }).headers = headers;

    let statusCode = 200;
    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
      setHeader() {
        /* noop */
      },
      end(payload?: string) {
        done({
          status: statusCode,
          body: payload ? JSON.parse(payload) : undefined,
        });
      },
    } as unknown as ServerResponse;

    middleware(req, res, () => done({ status: 'next' }));
  });
}

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('createSaveMiddleware', () => {
  let root: string;
  let assetsDir: string;
  let featuresDir: string;
  let assetsEn: string;
  let authEn: string;
  let base: Omit<SaveMiddlewareOptions, 'resolveFilePath'>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'live-i18n-mw-'));
    assetsDir = join(root, 'assets', 'i18n');
    featuresDir = join(root, 'features');
    assetsEn = join(assetsDir, 'en.json');
    authEn = join(featuresDir, 'auth', 'i18n', 'en.json');
    mkdirSync(assetsDir, { recursive: true });
    mkdirSync(join(featuresDir, 'auth', 'i18n'), { recursive: true });
    writeFileSync(
      assetsEn,
      JSON.stringify({ nav: { brand: 'Brand' } }, null, 2) + '\n',
    );
    writeFileSync(
      authEn,
      JSON.stringify({ auth: { login: 'Log in' } }, null, 2) + '\n',
    );

    base = {
      endpoint: ENDPOINT,
      indexer: TranslationIndexer.build({
        workspaceRoot: root,
        searchRoots: [assetsDir, featuresDir],
        logger: {
          info() {
            /* noop */
          },
          warn() {
            /* noop */
          },
        },
      }),
      defaultPath: assetsDir,
      allowedRoots: [assetsDir, featuresDir],
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('routes an indexed existing key and returns its revision', async () => {
    const result = await invoke(createSaveMiddleware(base), {
      key: 'auth.login',
      value: 'Sign in',
      lang: 'en',
      expectedValue: 'Log in',
    });

    expect(result.status).toBe(200);
    expect(result.body?.revision).toHaveLength(64);
    expect((read(authEn).auth as Record<string, unknown>).login).toBe(
      'Sign in',
    );
  });

  it('rejects a new key', async () => {
    const result = await invoke(createSaveMiddleware(base), {
      key: 'hero.cta',
      value: 'Go',
      lang: 'en',
    });

    expect(result.status).toBe(404);
    expect(result.body?.error).toContain('Adding keys is not supported');
  });

  it('lets a custom resolver route an existing key', async () => {
    writeFileSync(
      authEn,
      JSON.stringify({ auth: { login: 'Log in' }, nav: { brand: 'Brand' } }),
    );
    const middleware = createSaveMiddleware({
      ...base,
      resolveFilePath: () => authEn,
    });
    const result = await invoke(middleware, {
      key: 'nav.brand',
      value: 'Forced',
      lang: 'en',
    });

    expect(result.status).toBe(200);
    expect((read(authEn).nav as Record<string, unknown>).brand).toBe('Forced');
    expect((read(assetsEn).nav as Record<string, unknown>).brand).toBe('Brand');
  });

  it('falls back to the index when the resolver throws', async () => {
    const middleware = createSaveMiddleware({
      ...base,
      resolveFilePath: () => {
        throw new Error('boom');
      },
      logger: {
        warn() {
          /* noop */
        },
      },
    });
    const result = await invoke(middleware, {
      key: 'auth.login',
      value: 'Sign in',
      lang: 'en',
    });

    expect(result.status).toBe(200);
  });

  it('rejects malformed payloads', async () => {
    const result = await invoke(createSaveMiddleware(base), {
      key: 'auth.login',
      lang: 'en',
    });
    expect(result.status).toBe(400);
  });

  it('passes non-matching requests through', async () => {
    const result = await invoke(
      createSaveMiddleware(base),
      {},
      {
        method: 'GET',
        url: '/something',
      },
    );
    expect(result.status).toBe('next');
  });

  it('rejects non-JSON and cross-origin requests', async () => {
    const middleware = createSaveMiddleware(base);
    const nonJson = await invoke(
      middleware,
      {},
      {
        headers: { ...DEFAULT_HEADERS, 'content-type': 'text/plain' },
      },
    );
    const crossOrigin = await invoke(
      middleware,
      {},
      {
        headers: { ...DEFAULT_HEADERS, origin: 'https://attacker.example' },
      },
    );

    expect(nonJson.status).toBe(415);
    expect(crossOrigin.status).toBe(403);
  });

  it('requires a configured edit-session nonce', async () => {
    const result = await invoke(
      createSaveMiddleware({ ...base, sessionNonce: 'pilot-session' }),
      { key: 'nav.brand', value: 'New', lang: 'en' },
    );
    expect(result.status).toBe(401);
  });

  it('accepts an exact allowlisted origin', async () => {
    const middleware = createSaveMiddleware({
      ...base,
      allowedOrigins: ['https://staging.example'],
    });
    const result = await invoke(
      middleware,
      { key: 'nav.brand', value: 'New', lang: 'en' },
      {
        headers: {
          'content-type': 'application/json',
          origin: 'https://staging.example',
          host: 'localhost:4200',
        },
      },
    );
    expect(result.status).toBe(200);
  });

  it('returns 409 without writing when the expected value is stale', async () => {
    const result = await invoke(createSaveMiddleware(base), {
      key: 'nav.brand',
      value: 'New',
      lang: 'en',
      expectedValue: 'Stale',
    });

    expect(result.status).toBe(409);
    expect((read(assetsEn).nav as Record<string, unknown>).brand).toBe('Brand');
  });
});
