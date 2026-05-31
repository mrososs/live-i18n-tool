import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideLiveTranslations } from '@live-i18n/client';
import { appRoutes } from './app.routes';

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
