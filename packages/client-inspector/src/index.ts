export {
  provideLiveTranslations,
  type LiveTranslationsInput,
} from './lib/provide-live-translations';
export {
  DEFAULT_SAVE_ENDPOINT,
  LIVE_TRANSLATIONS_CONFIG,
  type LiveTranslationsConfig,
  type LiveTranslationsOptions,
} from './lib/config/live-translations.config';
export { SaveClient, type SaveResult } from './lib/api/save-client.service';
export { I18nKeyDirective } from './lib/directives/i18n-key.directive';
export {
  enableKeyMarkers,
  type TranslatePipeLike,
} from './lib/tracking/key-marker';
export { InspectorStateService } from './lib/state/inspector-state.service';
export { InspectorTrackingService } from './lib/tracking/inspector-tracking.service';
export { AutoTagService } from './lib/tracking/auto-tag.service';
export { InspectorOverlay } from './lib/components/inspector-overlay/inspector-overlay';
export { InspectorEditor } from './lib/components/inspector-editor/inspector-editor';
export { InspectorToggle } from './lib/components/inspector-toggle/inspector-toggle';
export type { InspectorState } from './lib/models/inspector-state.model';
