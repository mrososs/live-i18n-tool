import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import { forkJoin, map, type Observable } from 'rxjs';

/**
 * Per-locale sources, deep-merged in order (later wins on leaf conflicts). This
 * mirrors an enterprise "lazy i18n" setup where each feature ships its own
 * translation file next to its code, served alongside the app-wide dictionary.
 */
function sourcesFor(lang: string): string[] {
  return [
    `/assets/i18n/${lang}.json`,
    `/assets/features/auth/i18n/${lang}.json`,
  ];
}

/** Loads every source for a locale over HTTP and deep-merges them into one dict. */
@Injectable()
export class MergingTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<TranslationObject> {
    const requests = sourcesFor(lang).map((url) =>
      this.http.get<TranslationObject>(url),
    );
    return forkJoin(requests).pipe(
      map((dicts) =>
        dicts.reduce<Record<string, unknown>>(
          (acc, dict) => deepMerge(acc, dict as Record<string, unknown>),
          {},
        ) as TranslationObject,
    ),
    );
  }
}

/** Recursively merge plain objects; non-object leaves from `source` overwrite. */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      target[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      target[key] = value;
    }
  }
  return target;
}
