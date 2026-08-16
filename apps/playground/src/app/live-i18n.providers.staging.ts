import { inject } from '@angular/core';
import {
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import { withTransloco } from '@live-i18n/client';
import { provideStagingLiveTranslations } from '@live-i18n/client/staging';

/** Protected Pilot authoring. This file is used only by the explicit staging build. */
export const LIVE_I18N_PROVIDERS = [
  provideStagingLiveTranslations(
    () =>
      withTransloco(
        inject(TranslocoService),
        TranslocoPipe,
        TranslocoDirective,
      ),
    { apiBaseUrl: 'http://localhost:3000/api' },
  ),
];
