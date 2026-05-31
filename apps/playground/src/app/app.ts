import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { I18nKeyDirective } from '@live-i18n/client';
import { NxWelcome } from './nx-welcome';

@Component({
  imports: [NxWelcome, RouterModule, TranslatePipe, I18nKeyDirective],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'playground';

  private readonly translate = inject(TranslateService);
  protected readonly lang = signal('en');

  protected toggleLanguage(): void {
    const next = this.lang() === 'en' ? 'ar' : 'en';
    this.lang.set(next);
    this.translate.use(next);
  }
}
