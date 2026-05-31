import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  type ComponentRef,
  createComponent,
  EnvironmentInjector,
  type EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
  type Type,
} from '@angular/core';
import {
  DEFAULT_SAVE_ENDPOINT,
  type LiveTranslationsConfig,
  type LiveTranslationsOptions,
  LIVE_TRANSLATIONS_CONFIG,
} from './config/live-translations.config';
import { InspectorEditor } from './components/inspector-editor/inspector-editor';
import { InspectorOverlay } from './components/inspector-overlay/inspector-overlay';
import { InspectorToggle } from './components/inspector-toggle/inspector-toggle';
import { AutoTagService } from './tracking/auto-tag.service';
import { InspectorTrackingService } from './tracking/inspector-tracking.service';

/**
 * Options, or a factory that returns them. The factory runs inside an injection
 * context, so it may call `inject(...)` — e.g. to read `TranslateService`:
 *
 * ```ts
 * provideLiveTranslations(() => {
 *   const t = inject(TranslateService);
 *   return {
 *     getLocale: () => t.getCurrentLang(),
 *     getTranslations: () => latestTranslations,
 *   };
 * });
 * ```
 */
export type LiveTranslationsInput =
  | LiveTranslationsOptions
  | (() => LiveTranslationsOptions);

/**
 * Enables the live-i18n inspector. Add to your application providers:
 *
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideLiveTranslations()],
 * };
 * ```
 *
 * On startup (development only) it appends the overlay and editor components
 * directly to `document.body`, starts the global event tracker, and begins
 * auto-tagging translated elements with `data-i18n-key` — no markup is required
 * in your templates. In production builds the initializer early-returns, so the
 * inspector is inert.
 */
export function provideLiveTranslations(
  input?: LiveTranslationsInput,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: LIVE_TRANSLATIONS_CONFIG,
      useFactory: (): LiveTranslationsConfig => {
        const document = inject(DOCUMENT);
        const options = typeof input === 'function' ? input() : (input ?? {});
        return {
          getLocale:
            options.getLocale ??
            (() => document.documentElement.lang || 'en'),
          getTranslations: options.getTranslations ?? (() => ({})),
          endpoint: options.endpoint ?? DEFAULT_SAVE_ENDPOINT,
        };
      },
    },
    provideAppInitializer(() => {
      if (!isDevMode()) {
        return;
      }

      const appRef = inject(ApplicationRef);
      const environmentInjector = inject(EnvironmentInjector);
      const document = inject(DOCUMENT);
      const tracking = inject(InspectorTrackingService);
      const autoTag = inject(AutoTagService);

      const mount = <T,>(component: Type<T>): ComponentRef<T> => {
        const ref = createComponent(component, { environmentInjector });
        appRef.attachView(ref.hostView);
        document.body.appendChild(ref.location.nativeElement as HTMLElement);
        return ref;
      };

      mount(InspectorOverlay);
      mount(InspectorEditor);
      mount(InspectorToggle);

      tracking.init();
      autoTag.init();
    }),
  ]);
}
