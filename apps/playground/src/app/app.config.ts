import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  TranslateLoader,
  TranslatePipe,
  TranslateService,
  provideTranslateService,
} from '@ngx-translate/core';
import {
  provideLiveTranslations,
  withNgxTranslate,
} from '@live-i18n/client';
import { appRoutes } from './app.routes';
import { MergingTranslateLoader } from './i18n/merging-translate-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideTranslateService({
      loader: { provide: TranslateLoader, useClass: MergingTranslateLoader },
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideLiveTranslations(() =>
      withNgxTranslate(inject(TranslateService), TranslatePipe),
    ),
  ],
};
