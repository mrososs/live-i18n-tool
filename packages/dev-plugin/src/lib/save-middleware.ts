import type { IncomingMessage, ServerResponse } from 'node:http';
import { TranslationFileError, updateTranslationFile } from './update-translation-file.js';

export interface SaveMiddlewareOptions {
  /** Absolute path to the folder containing locale JSON files. */
  translationsPath: string;
  /** Route the middleware listens on (e.g. `/__live-i18n-update`). */
  endpoint: string;
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
  const { translationsPath, endpoint } = options;

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

        updateTranslationFile(translationsPath, lang, key, value);
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
