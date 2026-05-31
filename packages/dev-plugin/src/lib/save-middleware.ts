import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import {
  TranslationFileError,
  writeTranslationAtPath,
} from './update-translation-file.js';
import type { TranslationIndexer } from './translation-indexer.js';

/** Developer escape hatch: route a `key`/`lang` to an explicit file path. */
export type ResolveFilePath = (
  key: string,
  lang: string,
) => string | undefined;

export interface SaveMiddlewareOptions {
  /** Route the middleware listens on (e.g. `/__live-i18n-update`). */
  endpoint: string;
  /** Index mapping `lang:key` → owning file, built at server startup. */
  indexer: TranslationIndexer;
  /** Absolute fallback folder for keys not found in the index (new keys). */
  defaultPath: string;
  /** Absolute folders every resolved write path must stay within. */
  allowedRoots: string[];
  /** Optional custom resolver, consulted before the index. */
  resolveFilePath?: ResolveFilePath;
  /** Optional logger for non-fatal warnings (e.g. resolver throwing). */
  logger?: { warn(message: string): void };
}

/** Body posted by `@live-i18n/client` when a translation is saved. */
interface SavePayload {
  key: string;
  value: string;
  lang: string;
}

type NextFunction = (error?: unknown) => void;

/** Maximum accepted request body size (1 MB) — a translation string is tiny. */
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

/**
 * Connect-style middleware that handles `POST <endpoint>` by rewriting the
 * requested key in the matching locale file. All other requests fall through.
 */
export function createSaveMiddleware(options: SaveMiddlewareOptions) {
  const { endpoint, indexer, defaultPath, allowedRoots, resolveFilePath, logger } =
    options;

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
        const raw = await readBody(req);

        let payload: SavePayload;
        try {
          payload = JSON.parse(raw) as SavePayload;
        } catch {
          sendJson(res, 400, { ok: false, error: 'Invalid JSON body.' });
          return;
        }

        const { key, value, lang } = payload ?? ({} as SavePayload);
        if (typeof key !== 'string' || typeof value !== 'string' || typeof lang !== 'string') {
          sendJson(res, 400, {
            ok: false,
            error: 'Body must include string `key`, `value`, and `lang`.',
          });
          return;
        }

        // Resolution order: custom resolver → startup index → default folder.
        const indexed = indexer.resolve(lang, key);
        const filePath =
          resolveCustom(resolveFilePath, key, lang, logger) ??
          indexed ??
          resolve(defaultPath, `${lang}.json`);

        writeTranslationAtPath(filePath, lang, key, value, { allowedRoots });

        // A key not already in the index (new key, or routed by the resolver)
        // is recorded so repeat edits land in the same file.
        if (indexed === undefined) {
          indexer.record(lang, key, filePath);
        }

        sendJson(res, 200, { ok: true, key, lang });
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

/**
 * Call the optional resolver, swallowing failures: a throwing or empty resolver
 * simply falls through to the index/default so a bad hook never breaks saving.
 */
function resolveCustom(
  resolveFilePath: ResolveFilePath | undefined,
  key: string,
  lang: string,
  logger: { warn(message: string): void } | undefined,
): string | undefined {
  if (!resolveFilePath) {
    return undefined;
  }
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
