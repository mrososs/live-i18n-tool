import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  TranslationFileError,
  writeTranslationAtPath,
} from './update-translation-file.js';
import type { TranslationIndexer } from './translation-indexer.js';

export type ResolveFilePath = (key: string, lang: string) => string | undefined;

export interface SaveMiddlewareOptions {
  endpoint: string;
  indexer: TranslationIndexer;
  /** Retained for builder compatibility; new keys are deliberately rejected. */
  defaultPath: string;
  allowedRoots: string[];
  resolveFilePath?: ResolveFilePath;
  logger?: { warn(message: string): void };
  /** Exact browser origins allowed to save. Same-host origins remain allowed. */
  allowedOrigins?: string[];
  /** Optional nonce required in the `x-live-i18n-session` header. */
  sessionNonce?: string;
}

interface SavePayload {
  key: string;
  value: string;
  lang: string;
  expectedRevision?: string;
  expectedValue?: string;
}

type NextFunction = (error?: unknown) => void;
const MAX_BODY_BYTES = 1_000_000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new TranslationFileError('Request body too large.', 400));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isAllowedOrigin(
  req: IncomingMessage,
  allowedOrigins: string[],
): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin !== 'string') return false;
  if (allowedOrigins.includes(origin)) return true;
  if (typeof host !== 'string') return false;
  const encrypted = Boolean(
    (req.socket as (typeof req.socket & { encrypted?: boolean }) | undefined)
      ?.encrypted,
  );
  return origin === `${encrypted ? 'https' : 'http'}://${host}`;
}

/**
 * Connect middleware for existing-key local saves. Requests must be JSON,
 * originate from the dev server (or an exact allowlisted origin), and may be
 * protected by a configured edit-session nonce.
 */
export function createSaveMiddleware(options: SaveMiddlewareOptions) {
  const {
    endpoint,
    indexer,
    allowedRoots,
    resolveFilePath,
    logger,
    allowedOrigins = [],
    sessionNonce,
  } = options;

  return function liveI18nSaveMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFunction,
  ): void {
    const url = (req.url ?? '').split('?')[0];
    if (req.method !== 'POST' || url !== endpoint) {
      next();
      return;
    }

    void (async () => {
      try {
        const contentType = req.headers['content-type'] ?? '';
        if (!contentType.toLowerCase().startsWith('application/json')) {
          sendJson(res, 415, {
            ok: false,
            error: 'Content-Type must be application/json.',
          });
          return;
        }
        if (!isAllowedOrigin(req, allowedOrigins)) {
          sendJson(res, 403, { ok: false, error: 'Origin is not allowed.' });
          return;
        }
        if (
          sessionNonce &&
          req.headers['x-live-i18n-session'] !== sessionNonce
        ) {
          sendJson(res, 401, { ok: false, error: 'Invalid edit session.' });
          return;
        }

        const raw = await readBody(req);
        let payload: SavePayload;
        try {
          payload = JSON.parse(raw) as SavePayload;
        } catch {
          sendJson(res, 400, { ok: false, error: 'Invalid JSON body.' });
          return;
        }

        const { key, value, lang, expectedRevision, expectedValue } =
          payload ?? ({} as SavePayload);
        if (
          typeof key !== 'string' ||
          typeof value !== 'string' ||
          typeof lang !== 'string'
        ) {
          sendJson(res, 400, {
            ok: false,
            error: 'Body must include string `key`, `value`, and `lang`.',
          });
          return;
        }
        if (
          expectedRevision !== undefined &&
          typeof expectedRevision !== 'string'
        ) {
          sendJson(res, 400, {
            ok: false,
            error: '`expectedRevision` must be a string when provided.',
          });
          return;
        }
        if (expectedValue !== undefined && typeof expectedValue !== 'string') {
          sendJson(res, 400, {
            ok: false,
            error: '`expectedValue` must be a string when provided.',
          });
          return;
        }

        const indexed = indexer.resolve(lang, key);
        const filePath =
          resolveCustom(resolveFilePath, key, lang, logger) ?? indexed;
        if (!filePath) {
          sendJson(res, 404, {
            ok: false,
            error: `Translation key not found: ${key}. Adding keys is not supported.`,
          });
          return;
        }

        const result = writeTranslationAtPath(filePath, lang, key, value, {
          allowedRoots,
          expectedRevision,
          expectedValue,
        });
        sendJson(res, 200, {
          ok: true,
          key,
          lang,
          revision: result.revision,
        });
      } catch (error) {
        if (error instanceof TranslationFileError) {
          sendJson(res, error.status, { ok: false, error: error.message });
          return;
        }
        sendJson(res, 500, { ok: false, error: (error as Error).message });
      }
    })();
  };
}

function resolveCustom(
  resolveFilePath: ResolveFilePath | undefined,
  key: string,
  lang: string,
  logger: { warn(message: string): void } | undefined,
): string | undefined {
  if (!resolveFilePath) return undefined;
  try {
    const custom = resolveFilePath(key, lang);
    return typeof custom === 'string' && custom.length > 0 ? custom : undefined;
  } catch (error) {
    logger?.warn(
      `[live-i18n] resolveFilePath threw for "${key}" (${lang}); ` +
        `falling back to the index. ${(error as Error).message}`,
    );
    return undefined;
  }
}
