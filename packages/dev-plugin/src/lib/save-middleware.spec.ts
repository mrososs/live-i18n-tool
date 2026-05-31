import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSaveMiddleware, type SaveMiddlewareOptions } from './save-middleware.js';
import { TranslationIndexer } from './translation-indexer.js';

const ENDPOINT = '/__live-i18n-update';

interface InvokeResult {
  status: number | 'next';
  body?: { ok?: boolean; error?: string };
}

/** Drive the middleware with a mock request/response and resolve on completion. */
function invoke(
  middleware: ReturnType<typeof createSaveMiddleware>,
  body: unknown,
  { method = 'POST', url = ENDPOINT } = {},
): Promise<InvokeResult> {
  return new Promise((done) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    (req as { method?: string }).method = method;
    (req as { url?: string }).url = url;

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
    writeFileSync(assetsEn, JSON.stringify({ nav: { brand: 'Brand' } }, null, 2) + '\n');
    writeFileSync(authEn, JSON.stringify({ auth: { login: 'Log in' } }, null, 2) + '\n');

    const indexer = TranslationIndexer.build({
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
    });

    base = {
      endpoint: ENDPOINT,
      indexer,
      defaultPath: assetsDir,
      allowedRoots: [assetsDir, featuresDir],
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('routes an indexed key to its owning feature file', async () => {
    const mw = createSaveMiddleware(base);
    const result = await invoke(mw, { key: 'auth.login', value: 'Sign in', lang: 'en' });

    expect(result.status).toBe(200);
    expect((read(authEn).auth as Record<string, unknown>).login).toBe('Sign in');
    expect((read(assetsEn).nav as Record<string, unknown>).brand).toBe('Brand'); // untouched
  });

  it('falls back to defaultPath for a new key and records it in the index', async () => {
    const mw = createSaveMiddleware(base);
    const result = await invoke(mw, { key: 'hero.cta', value: 'Go', lang: 'en' });

    expect(result.status).toBe(200);
    expect((read(assetsEn).hero as Record<string, unknown>).cta).toBe('Go');
    // Recorded → a subsequent resolve points at the default file.
    expect(base.indexer.resolve('en', 'hero.cta')).toBe(assetsEn);
  });

  it('lets a custom resolver win over the index', async () => {
    const mw = createSaveMiddleware({ ...base, resolveFilePath: () => authEn });
    // nav.brand is indexed to assetsEn, but the resolver forces the auth file.
    const result = await invoke(mw, { key: 'nav.brand', value: 'Forced', lang: 'en' });

    expect(result.status).toBe(200);
    expect((read(authEn).nav as Record<string, unknown>).brand).toBe('Forced');
    expect((read(assetsEn).nav as Record<string, unknown>).brand).toBe('Brand'); // untouched
  });

  it('falls back to the index when the resolver throws', async () => {
    const mw = createSaveMiddleware({
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
    const result = await invoke(mw, { key: 'auth.login', value: 'Sign in', lang: 'en' });

    expect(result.status).toBe(200);
    expect((read(authEn).auth as Record<string, unknown>).login).toBe('Sign in');
  });

  it('rejects a malformed body with 400', async () => {
    const mw = createSaveMiddleware(base);
    const result = await invoke(mw, { key: 'auth.login', lang: 'en' }); // no value

    expect(result.status).toBe(400);
    expect(result.body?.ok).toBe(false);
  });

  it('passes non-matching requests through to next()', async () => {
    const mw = createSaveMiddleware(base);
    const result = await invoke(mw, {}, { method: 'GET', url: '/something' });

    expect(result.status).toBe('next');
  });
});
