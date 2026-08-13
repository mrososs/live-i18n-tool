import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { SaveClient } from '../../api/save-client.service';
import { LIVE_TRANSLATIONS_CONFIG } from '../../config/live-translations.config';
import { InspectorStateService } from '../../state/inspector-state.service';

/** Approximate panel width, used to clamp it inside the viewport. */
const PANEL_WIDTH = 300;
/** Gap between the highlighted element and the panel. */
const GAP = 8;
/** Approximate maximum panel height used to keep the editor in view. */
const PANEL_HEIGHT = 260;

type EditorStatus = 'idle' | 'dirty' | 'saving' | 'failed';

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
        role="dialog"
        aria-modal="false"
        aria-labelledby="li18n-editor-title"
        aria-describedby="li18n-editor-status"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
      >
        <header class="li18n-editor__header">
          <span id="li18n-editor-title" class="li18n-editor__label">
            Translation key
          </span>
          <code class="li18n-editor__key">{{ state.activeKey() }}</code>
        </header>

        <label class="li18n-editor__field-label" for="li18n-editor-input">
          Translation
        </label>
        <textarea
          #editorInput
          id="li18n-editor-input"
          name="li18n-editor-input"
          class="li18n-editor__input"
          rows="3"
          [value]="draft()"
          [disabled]="status() === 'saving'"
          (input)="updateDraft($any($event.target).value)"
          (keydown.enter)="$event.stopPropagation()"
        ></textarea>

        <p
          id="li18n-editor-status"
          class="li18n-editor__status"
          [class.li18n-editor__status--error]="status() === 'failed'"
          aria-live="polite"
        >
          {{ statusMessage() }}
        </p>

        <footer class="li18n-editor__actions">
          <button
            type="button"
            class="li18n-btn"
            [disabled]="status() === 'saving'"
            (click)="cancel()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="li18n-btn li18n-btn--primary"
            [disabled]="status() === 'saving'"
            (click)="save()"
          >
            {{ status() === 'saving' ? 'Saving…' : 'Save' }}
          </button>
        </footer>
      </div>
    }
  `,
})
export class InspectorEditor {
  protected readonly state = inject(InspectorStateService);
  private readonly saveClient = inject(SaveClient);
  private readonly config = inject(LIVE_TRANSLATIONS_CONFIG, {
    optional: true,
  });
  private readonly window = inject(DOCUMENT).defaultView;

  /** Element and exact text node whose content is being previewed. */
  private previewTarget: HTMLElement | null = null;
  private previewTextNode: Text | null = null;
  private previewTextNodes: Array<{ node: Text; originalValue: string }> = [];
  private originalTranslationValue: string | null = null;
  protected readonly status = signal<EditorStatus>('idle');
  protected readonly statusMessage = computed(() => {
    switch (this.status()) {
      case 'saving':
        return 'Saving translation…';
      case 'failed':
        return this.errorMessage() || 'Save failed. Your draft is still open.';
      case 'dirty':
        return 'Unsaved changes.';
      default:
        return 'Ready to edit.';
    }
  });
  private readonly errorMessage = signal('');

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
        this.previewTextNodes = this.findPreviewTextNodes(element);
        this.previewTextNode =
          this.previewTextNodes.find(({ originalValue }) =>
            originalValue.trim(),
          )?.node ??
          this.previewTextNodes[0]?.node ??
          null;
        this.originalTranslationValue = value;
      }

      for (const { node } of this.previewTextNodes) {
        node.nodeValue = node === this.previewTextNode ? value : '';
      }
    });
  }

  /** Panel position, anchored below the element and clamped to the viewport. */
  protected readonly position = computed(() => {
    const rect = this.state.overlayRect();
    if (!rect) {
      return { top: 0, left: 0 };
    }
    const maxLeft =
      (this.window?.innerWidth ?? PANEL_WIDTH) - PANEL_WIDTH - GAP;
    const viewportHeight = this.window?.innerHeight ?? PANEL_HEIGHT;
    const below = rect.bottom + GAP;
    const above = rect.top - PANEL_HEIGHT - GAP;
    return {
      top: Math.max(
        GAP,
        below + PANEL_HEIGHT <= viewportHeight ? below : above,
      ),
      left: Math.max(GAP, Math.min(rect.left, maxLeft)),
    };
  });

  protected updateDraft(value: string): void {
    this.draft.set(value);
    this.errorMessage.set('');
    this.status.set('dirty');
  }

  protected async save(): Promise<void> {
    const key = this.state.activeKey();
    if (key === null || this.status() === 'saving') {
      return;
    }

    this.status.set('saving');
    const result = await this.saveClient.save(
      key,
      this.draft(),
      this.originalTranslationValue ?? undefined,
    );
    if (!result.ok) {
      this.errorMessage.set(result.error || 'The translation was not saved.');
      this.status.set('failed');
      return;
    }

    this.resetPreview();
    this.state.closeEditor();
  }

  protected cancel(): void {
    // Roll the live preview back to the text we captured before editing.
    for (const { node, originalValue } of this.previewTextNodes) {
      node.nodeValue = originalValue;
    }
    this.resetPreview();
    this.state.closeEditor();
  }

  private resetPreview(): void {
    this.previewTarget = null;
    this.previewTextNode = null;
    this.previewTextNodes = [];
    this.originalTranslationValue = null;
    this.errorMessage.set('');
    this.status.set('idle');
  }

  /**
   * Choose one existing text node for preview. Editing that node preserves
   * nested markup and its event listeners instead of replacing the host DOM.
   */
  private findPreviewTextNodes(
    element: HTMLElement,
  ): Array<{ node: Text; originalValue: string }> {
    const walker = element.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
    );
    const nodes: Array<{ node: Text; originalValue: string }> = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      nodes.push({ node: text, originalValue: text.nodeValue ?? '' });
    }
    return nodes;
  }
}
