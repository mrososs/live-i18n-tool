import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Translation, TranslocoLoader } from '@jsverse/transloco';
import { forkJoin, map, type Observable } from 'rxjs';

function sourcesFor(lang: string): string[] {
  return [
    `/assets/i18n/${lang}.json`,
    `/assets/features/auth/i18n/${lang}.json`,
  ];
}

@Injectable({ providedIn: 'root' })
export class MergingTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<Translation> {
    return forkJoin(
      sourcesFor(lang).map((url) =>
        this.http.get<Record<string, unknown>>(url),
      ),
    ).pipe(
      map((dicts) =>
        dicts.reduce<Record<string, unknown>>(
          (acc, dict) => deepMerge(acc, dict),
          {},
        ),
      ),
    );
  }
}

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
