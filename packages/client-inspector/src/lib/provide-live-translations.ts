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
import { InspectorEditor } from './components/inspector-editor/inspector-editor';
import { InspectorOverlay } from './components/inspector-overlay/inspector-overlay';
import { InspectorToggle } from './components/inspector-toggle/inspector-toggle';
import { InspectorTrackingService } from './tracking/inspector-tracking.service';

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
 * directly to `document.body` and starts the global event tracker — no markup
 * is required in your templates. In production builds the initializer
 * early-returns, so the inspector is inert.
 */
export function provideLiveTranslations(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      if (!isDevMode()) {
        return;
      }

      const appRef = inject(ApplicationRef);
      const environmentInjector = inject(EnvironmentInjector);
      const document = inject(DOCUMENT);
      const tracking = inject(InspectorTrackingService);

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
    }),
  ]);
}
