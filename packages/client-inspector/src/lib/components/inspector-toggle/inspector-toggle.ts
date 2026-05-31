import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { InspectorStateService } from '../../state/inspector-state.service';

/**
 * Floating control (Vue-devtools style) that switches inspect mode on and off.
 *
 * Lives fixed in the bottom-right corner. Inspect mode can also be toggled with
 * the `Alt+Shift+I` keyboard shortcut, or programmatically through
 * {@link InspectorStateService.toggle}/`setEnabled`.
 */
@Component({
  selector: 'li18n-inspector-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './inspector-toggle.scss',
  host: {
    '(document:keydown.alt.shift.i)': 'onShortcut($event)',
  },
  template: `
    <button
      type="button"
      class="li18n-toggle"
      [class.li18n-toggle--active]="state.enabled()"
      [attr.aria-pressed]="state.enabled()"
      [title]="
        state.enabled()
          ? 'Live i18n: inspect mode ON (Alt+Shift+I)'
          : 'Live i18n: inspect mode OFF (Alt+Shift+I)'
      "
      (click)="state.toggle()"
    >
      <span class="li18n-toggle__icon" aria-hidden="true">🌐</span>
      <span class="li18n-toggle__label">
        i18n {{ state.enabled() ? 'ON' : 'OFF' }}
      </span>
    </button>
  `,
})
export class InspectorToggle {
  protected readonly state = inject(InspectorStateService);

  protected onShortcut(event: Event): void {
    event.preventDefault();
    this.state.toggle();
  }
}
