import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { InspectorStateService } from '../../state/inspector-state.service';

/**
 * A floating "ghost" highlight that tracks the hovered translatable element.
 *
 * Rendered with `position: fixed` and `pointer-events: none` so it never
 * shifts layout nor steals the hover from the element underneath. Hidden while
 * the editor is open.
 */
@Component({
  selector: 'li18n-inspector-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './inspector-overlay.scss',
  template: `
    @if (visible()) {
      <div
        class="li18n-overlay"
        [style.top.px]="rect()!.top"
        [style.left.px]="rect()!.left"
        [style.width.px]="rect()!.width"
        [style.height.px]="rect()!.height"
      ></div>
    }
  `,
})
export class InspectorOverlay {
  private readonly state = inject(InspectorStateService);

  protected readonly rect = this.state.overlayRect;
  protected readonly visible = computed(
    () =>
      this.state.enabled() &&
      this.state.hoveredElement() !== null &&
      !this.state.isEditing() &&
      this.state.overlayRect() !== null,
  );
}
