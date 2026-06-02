import { type LiveTranslationsOptions } from '../config/live-translations.config';
import { type TranslatePipeLike } from '../tracking/key-marker';

interface NgxTranslateLike {
  getCurrentLang(): string;
  onLangChange: {
    subscribe(fn: (event: { translations: unknown }) => void): unknown;
  };
}

export function withNgxTranslate(
  service: NgxTranslateLike,
  Pipe: TranslatePipeLike,
): LiveTranslationsOptions {
  let translations: Record<string, unknown> = {};
  service.onLangChange.subscribe((event) => {
    translations = event.translations as Record<string, unknown>;
  });
  return {
    patchPipe: Pipe,
    getLocale: () => service.getCurrentLang(),
    getTranslations: () => translations,
  };
}
