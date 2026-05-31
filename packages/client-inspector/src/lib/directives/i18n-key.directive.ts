import { Directive, input } from '@angular/core';

/**
 * Marks an element as translatable so the inspector can highlight and edit it.
 *
 * Use alongside your existing translation pipe/binding:
 *
 * ```html
 * <h1 i18nKey="demo.title">{{ 'demo.title' | translate }}</h1>
 * ```
 *
 * It only reflects the key onto the `data-i18n-key` attribute — it does not
 * perform translation itself.
 */
@Directive({
  selector: '[i18nKey]',
  host: {
    '[attr.data-i18n-key]': 'i18nKey()',
  },
})
export class I18nKeyDirective {
  /** The translation key for this element. */
  readonly i18nKey = input.required<string>();
}
