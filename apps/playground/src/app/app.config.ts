import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  TranslatePipe,
  TranslateService,
  provideTranslateService,
} from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { enableKeyMarkers, provideLiveTranslations } from '@live-i18n/client';
import { appRoutes } from './app.routes';

// Emit invisible key markers from the translate pipe so the inspector can
// recover the exact key per element — even when two keys render the same text
// (dev-only; a no-op in production builds).
enableKeyMarkers(TranslatePipe, isDevMode());

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideLiveTranslations(() => {
      const translate = inject(TranslateService);
      // Cache the active dictionary; ngx-translate emits it on every change.
      let translations: Record<string, unknown> = {};
      translate.onLangChange.subscribe((event) => {
        translations = event.translations as Record<string, unknown>;
      });
      return {
        getLocale: () => translate.getCurrentLang(),
        getTranslations: () => translations,
      };
    }),
  ],
};
