import {
  type DirectivePatch,
  type LiveTranslationsOptions,
} from '../config/live-translations.config';
import { type TranslatePipeLike } from '../tracking/key-marker';

interface TranslocoLike {
  getActiveLang(): string;
  getTranslation(lang: string): Record<string, unknown>;
  langChanges$: {
    subscribe(fn: (lang: string) => void): unknown;
  };
}

interface TranslocoDirectiveInstance {
  transloco: string | undefined;
  el: { nativeElement: HTMLElement } | undefined;
}

function buildDirectivePatch(DirectiveClass: unknown): DirectivePatch {
  return {
    directive: DirectiveClass,
    getKey: (instance) =>
      (instance as TranslocoDirectiveInstance).transloco,
    getElement: (instance) =>
      (instance as TranslocoDirectiveInstance).el?.nativeElement,
  };
}

export function withTransloco(
  service: TranslocoLike,
  Pipe: TranslatePipeLike,
  /** Pass `TranslocoDirective` to also tag `[transloco]="'key'"` elements. */
  DirectiveClass?: unknown,
): LiveTranslationsOptions {
  let activeLang = service.getActiveLang();
  service.langChanges$.subscribe((lang) => {
    activeLang = lang;
  });
  return {
    patchPipe: Pipe,
    patchDirectives: DirectiveClass ? [buildDirectivePatch(DirectiveClass)] : [],
    getLocale: () => activeLang,
    getTranslations: () => service.getTranslation(activeLang),
  };
}
