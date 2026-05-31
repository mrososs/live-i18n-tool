import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { SaveClient } from '../../api/save-client.service';
import { LIVE_TRANSLATIONS_CONFIG } from '../../config/live-translations.config';
import { InspectorStateService } from '../../state/inspector-state.service';

/** Approximate panel width, used to clamp it inside the viewport. */
const PANEL_WIDTH = 300;
/** Gap between the highlighted element and the panel. */
const GAP = 8;

/**
 * Resolve a dotted translation key (`a.b.c`) against a nested dictionary,
 * returning the leaf string value, or `null` when the key is absent or its
 * value is not a string.
 */
function resolveTranslation(
  dictionary: Record<string, unknown>,
  key: string,
): string | null {
  let node: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return null;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Floating popover for editing the translation of the active element.
 *
 * Positioned with `position: fixed` just below the highlighted element and
 * clamped to the viewport. "Save" posts the edit to the dev-plugin (which
 * rewrites the locale file on disk); the live preview already reflects it.
 */
@Component({
  selector: 'li18n-inspector-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './inspector-editor.scss',
  host: {
    '(document:keydown.escape)': 'cancel()',
  },
  template: `
    @if (state.isEditing()) {
      <div
        class="li18n-editor"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
      >
        <header class="li18n-editor__header">
          <span class="li18n-editor__label">Translation key</span>
          <code class="li18n-editor__key">{{ state.activeKey() }}</code>
        </header>

        <textarea
          id="li18n-editor-input"
          name="li18n-editor-input"
          class="li18n-editor__input"
          rows="3"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="$event.stopPropagation()"
        ></textarea>

        <footer class="li18n-editor__actions">
          <button type="button" class="li18n-btn" (click)="cancel()">
            Cancel
          </button>
          <button
            type="button"
            class="li18n-btn li18n-btn--primary"
            (click)="save()"
          >
            Save
          </button>
        </footer>
      </div>
    }
  `,
})
export class InspectorEditor {
  protected readonly state = inject(InspectorStateService);
  private readonly saveClient = inject(SaveClient);
  private readonly config = inject(LIVE_TRANSLATIONS_CONFIG, { optional: true });
  private readonly window = inject(DOCUMENT).defaultView;

  /** Element whose text is being previewed, plus its text before editing. */
  private previewTarget: HTMLElement | null = null;
  private originalText: string | null = null;

  /**
   * Editable draft, seeded from the raw dictionary value for the active key so
   * the user edits the canonical source string (including any `{{ … }}`
   * placeholders) rather than the interpolated text rendered in the DOM. Falls
   * back to the element's text when the key is missing from the dictionary.
   * Re-seeds whenever a different key becomes active (the `source`).
   */
  protected readonly draft = linkedSignal({
    source: this.state.activeKey,
    computation: (key) => {
      const fromDictionary =
        key !== null
          ? resolveTranslation(this.config?.getTranslations() ?? {}, key)
          : null;
      return (
        fromDictionary ?? this.state.hoveredElement()?.textContent?.trim() ?? ''
      );
    },
  });

  constructor() {
    // Live preview: reflect the draft into the real element as the user types.
    // Snapshots the original text the first time an element starts editing so
    // Cancel/Escape can restore it.
    effect(() => {
      const editing = this.state.isEditing();
      const value = this.draft();

      if (!editing) {
        return;
      }

      const element = untracked(() => this.state.hoveredElement());
      if (!element) {
        return;
      }

      if (this.previewTarget !== element) {
        this.previewTarget = element;
        this.originalText = element.textContent;
      }

      element.textContent = value;
    });
  }

  /** Panel position, anchored below the element and clamped to the viewport. */
  protected readonly position = computed(() => {
    const rect = this.state.overlayRect();
    if (!rect) {
      return { top: 0, left: 0 };
    }
    const maxLeft = (this.window?.innerWidth ?? PANEL_WIDTH) - PANEL_WIDTH - GAP;
    return {
      top: rect.bottom + GAP,
      left: Math.max(GAP, Math.min(rect.left, maxLeft)),
    };
  });

  protected save(): void {
    const key = this.state.activeKey();
    if (key !== null) {
      // Persist to disk via the dev-plugin. Optimistic: the preview text is
      // already in the DOM, so we close immediately and let the POST settle.
      void this.saveClient.save(key, this.draft());
    }
    this.resetPreview();
    this.state.closeEditor();
  }

  protected cancel(): void {
    // Roll the live preview back to the text we captured before editing.
    if (this.previewTarget && this.originalText !== null) {
      this.previewTarget.textContent = this.originalText;
    }
    this.resetPreview();
    this.state.closeEditor();
  }

  private resetPreview(): void {
    this.previewTarget = null;
    this.originalText = null;
  }
}
