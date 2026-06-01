import { InjectionToken } from '@angular/core';
import { type TranslatePipeLike } from '../tracking/key-marker';

/** Default dev-server route the save client posts to. Mirrors the dev-plugin. */
export const DEFAULT_SAVE_ENDPOINT = '/__live-i18n-update';

/**
 * Describes how to extract the translation key and host element from a
 * directive instance. Used by {@link enableKeyMarkersOnDirective} to stamp
 * `data-i18n-key` on elements translated via attribute directives (e.g.
 * `[transloco]="'key'"`).
 */
export interface DirectivePatch {
  directive: unknown;
  getKey: (instance: unknown) => string | undefined;
  getElement: (instance: unknown) => HTMLElement | undefined;
}

/**
 * Host-supplied hooks for the inspector. Kept framework-agnostic: the host
 * decides how to read the current locale and the loaded translation
 * dictionary (e.g. from `@ngx-translate/core`), so the client never depends on
 * a particular i18n library.
 */
export interface LiveTranslationsOptions {
  /** Returns the locale currently displayed (the file the save API rewrites). */
  getLocale?: () => string;
  /** Returns the loaded translations for the current locale (nested object). */
  getTranslations?: () => Record<string, unknown>;
  /** Overrides the save endpoint (defaults to `/__live-i18n-update`). */
  endpoint?: string;
  /** When provided, {@link enableKeyMarkers} is called on this pipe class at startup. */
  patchPipe?: TranslatePipeLike;
  /** When provided, {@link enableKeyMarkersOnDirective} is called for each entry at startup. */
  patchDirectives?: DirectivePatch[];
}

/** Fully-resolved configuration with defaults applied. */
export interface LiveTranslationsConfig {
  getLocale: () => string;
  getTranslations: () => Record<string, unknown>;
  endpoint: string;
}

/** DI token carrying the resolved {@link LiveTranslationsConfig}. */
export const LIVE_TRANSLATIONS_CONFIG = new InjectionToken<LiveTranslationsConfig>(
  'LIVE_TRANSLATIONS_CONFIG',
);
