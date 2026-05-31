import { inject, Injectable } from '@angular/core';
import {
  DEFAULT_SAVE_ENDPOINT,
  LIVE_TRANSLATIONS_CONFIG,
} from '../config/live-translations.config';

/**
 * Why a save failed, so callers (and logs) can react meaningfully:
 * - `plugin-unavailable` — the dev server never reached the plugin middleware
 *   (route 404s, or the SPA fallback returned `index.html`). Almost always means
 *   `@live-i18n/plugin` is not installed or its dev-server builder isn't active.
 * - `server-error` — the plugin handled the request but rejected/failed the write.
 * - `network-error` — the request never completed (server unreachable).
 */
export type SaveErrorKind =
  | 'plugin-unavailable'
  | 'server-error'
  | 'network-error';

/** Outcome of a save attempt. */
export interface SaveResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** Present only when `ok` is `false`. */
  kind?: SaveErrorKind;
}

/** The JSON contract the dev-plugin save middleware always replies with. */
interface PluginResponse {
  ok: boolean;
  error?: string;
}

/**
 * Narrows a parsed response body to the plugin's JSON contract. Anything that
 * isn't `{ ok: boolean }` (HTML, empty, garbage) means the plugin middleware
 * never handled the request — i.e. the plugin is unavailable.
 */
function isPluginResponse(body: unknown): body is PluginResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>)['ok'] === 'boolean'
  );
}

interface SaveFailureContext {
  key: string;
  lang: string;
  endpoint: string;
  status?: number;
  error?: string;
}

/** Emits a single, readable, actionable `console.error` for a failed save. */
function logSaveFailure(kind: SaveErrorKind, ctx: SaveFailureContext): void {
  const lang = ctx.lang || 'the current locale';
  switch (kind) {
    case 'plugin-unavailable':
      console.error(
        `[live-i18n] Save failed: the dev-server save API at "${ctx.endpoint}" did not respond.\n` +
          'This almost always means @live-i18n/plugin is not installed or its dev-server builder is not active.\n' +
          'Fix it by:\n' +
          '  1) installing the plugin:  npm i -D @live-i18n/plugin\n' +
          '  2) switching your serve target to the "@live-i18n/plugin:dev-server" builder.\n' +
          `Your edit "${ctx.key}" is still shown in the page but was NOT written to ${lang}.json on disk.`,
      );
      return;
    case 'server-error':
      console.error(
        `[live-i18n] Save failed for "${ctx.key}" (${lang}.json): ` +
          `${ctx.error || 'unknown server error'} (HTTP ${ctx.status ?? '?'})`,
      );
      return;
    case 'network-error':
      console.error(
        `[live-i18n] Save failed: could not reach the dev server at "${ctx.endpoint}" ` +
          `(${ctx.error || 'unknown error'}). Is \`ng serve\` running?`,
      );
      return;
  }
}

/**
 * Posts a single translation edit to the dev-plugin's save endpoint. The
 * locale is read from the host-supplied {@link LiveTranslationsConfig}; the
 * dev server rewrites the matching `<lang>.json` file on disk.
 *
 * Failures are reported (logged + returned) rather than thrown — the editor
 * has already previewed the change optimistically.
 */
@Injectable({ providedIn: 'root' })
export class SaveClient {
  private readonly config = inject(LIVE_TRANSLATIONS_CONFIG, { optional: true });

  async save(key: string, value: string): Promise<SaveResult> {
    const endpoint = this.config?.endpoint ?? DEFAULT_SAVE_ENDPOINT;
    const lang = this.config?.getLocale?.() ?? '';

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, lang }),
      });
    } catch (error) {
      const message = (error as Error).message;
      logSaveFailure('network-error', { key, lang, endpoint, error: message });
      return { ok: false, kind: 'network-error', error: message };
    }

    // Trust the result only when the body is the plugin's JSON contract. Any
    // other shape means the plugin middleware never handled the request — even
    // a 200 (the dev server's SPA fallback serving index.html).
    const raw = await response.text().catch(() => '');
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }

    if (!isPluginResponse(body)) {
      logSaveFailure('plugin-unavailable', { key, lang, endpoint, status: response.status });
      return { ok: false, kind: 'plugin-unavailable', status: response.status };
    }

    if (body.ok) {
      return { ok: true, status: response.status };
    }

    logSaveFailure('server-error', {
      key,
      lang,
      endpoint,
      status: response.status,
      error: body.error,
    });
    return {
      ok: false,
      kind: 'server-error',
      status: response.status,
      error: body.error,
    };
  }
}
