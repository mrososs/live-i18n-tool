import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A faux browser window demonstrating the core loop: a translated phrase is
 * highlighted on hover (amber outline + data-i18n-key tag) and a floating
 * editor sits over it. Pure CSS motion — no timers, honors reduced-motion.
 */
@Component({
  selector: 'app-browser-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './browser-demo.html',
  styleUrl: './browser-demo.scss',
})
export class BrowserDemo {}
