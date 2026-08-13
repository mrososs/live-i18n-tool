import { inject } from '@angular/core';
import {
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { provideLiveTranslations, withTransloco } from '@live-i18n/client';

/** Development authoring providers. Replaced completely in production. */
export const LIVE_I18N_PROVIDERS = [
  provideLiveTranslations(() =>
    withTransloco(inject(TranslocoService), TranslocoPipe, TranslocoDirective),
  ),
];
