import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  provideTransloco,
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { provideLiveTranslations, withTransloco } from '@live-i18n/client';
import { appRoutes } from './app.routes';
import { MergingTranslocoLoader } from './i18n/merging-transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
      },
      loader: MergingTranslocoLoader,
    }),
    provideLiveTranslations(() =>
      withTransloco(inject(TranslocoService), TranslocoPipe, TranslocoDirective),
    ),
  ],
};
