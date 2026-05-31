import { DOCUMENT } from '@angular/common';
import {
  Component,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type Locale = 'en' | 'ar';

@Component({
  selector: 'app-root',
  imports: [TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  protected readonly lang = signal<Locale>('en');

  /** Stable interpolation params so the translate pipe isn't re-evaluated. */
  protected readonly greetingParams = { name: 'Mohamed' };
  protected readonly trustParams = { count: 1200, locales: 40 };
  protected readonly languagesParams = { count: 40 };
  protected readonly savedHoursParams = { count: 12 };
  protected readonly keysEditedParams = { count: 8400 };

  /** Label for the language toggle — always the *other* language's name. */
  protected readonly otherLanguageLabel = signal('العربية');

  constructor() {
    // Keep <html lang>/<dir> in sync so RTL layout flips when Arabic is active.
    effect(() => {
      const locale = this.lang();
      const root = this.document.documentElement;
      root.setAttribute('lang', locale);
      root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    });
  }

  protected toggleLanguage(): void {
    const next: Locale = this.lang() === 'en' ? 'ar' : 'en';
    this.lang.set(next);
    this.otherLanguageLabel.set(next === 'en' ? 'العربية' : 'English');
    this.translate.use(next);
  }
}
