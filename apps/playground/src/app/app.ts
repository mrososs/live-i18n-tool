import { DOCUMENT } from '@angular/common';
import {
  Component,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';

type Locale = 'en' | 'ar';

@Component({
  selector: 'app-root',
  imports: [TranslocoPipe, TranslocoDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  protected readonly lang = signal<Locale>('en');

  protected readonly greetingParams = { name: 'Mohamed' };
  protected readonly trustParams = { count: 1200, locales: 40 };
  protected readonly languagesParams = { count: 40 };
  protected readonly savedHoursParams = { count: 12 };
  protected readonly keysEditedParams = { count: 8400 };

  protected readonly otherLanguageLabel = signal('العربية');

  constructor() {
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
    this.transloco.setActiveLang(next);
  }
}
