import { inject, Injectable } from '@angular/core';
import {
  DEFAULT_SAVE_ENDPOINT,
  LIVE_TRANSLATIONS_CONFIG,
} from '../config/live-translations.config';

/** Outcome of a save attempt. */
export interface SaveResult {
  ok: boolean;
  status?: number;
  error?: string;
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

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, lang }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        console.error('[live-i18n] save failed', response.status, error);
        return { ok: false, status: response.status, error };
      }

      return { ok: true, status: response.status };
    } catch (error) {
      console.error('[live-i18n] save request failed', error);
      return { ok: false, error: (error as Error).message };
    }
  }
}
