import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import type { Observable } from 'rxjs';

/**
 * Loads a single per-locale dictionary over HTTP from `/assets/i18n/<lang>.json`.
 * The landing page ships one locale, so no feature-split merging is needed.
 */
@Injectable()
export class JsonTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`/assets/i18n/${lang}.json`);
  }
}
