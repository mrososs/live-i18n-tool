import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import type { Observable } from 'rxjs';

/**
 * Loads a single per-locale dictionary over HTTP from `assets/i18n/<lang>.json`.
 * The landing page ships one locale, so no feature-split merging is needed.
 *
 * The path is intentionally relative (no leading slash) so it resolves against
 * the document's `<base href>`. Locally that base is `/`; on GitHub Pages the
 * production build sets it to `/live-i18n-tool/`. A leading-slash absolute path
 * would ignore the base href and 404 when the app is served from a sub-path.
 */
@Injectable()
export class JsonTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`assets/i18n/${lang}.json`);
  }
}
