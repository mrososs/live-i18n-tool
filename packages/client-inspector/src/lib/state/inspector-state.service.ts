import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

/** localStorage key under which the inspect-mode on/off choice is persisted. */
const STORAGE_KEY = 'live-i18n:enabled';

/**
 * Signal-based store for the inspector. Holds whether inspect mode is enabled,
 * which translatable element is hovered, its key and bounding box, and whether
 * the editor popover is open.
 *
 * Exposed as read-only signals; mutations go through the explicit methods so
 * the open/close transitions stay consistent.
 */
@Injectable({ providedIn: 'root' })
export class InspectorStateService {
  private readonly window = inject(DOCUMENT).defaultView;

  private readonly _enabled = signal<boolean>(this.readPersistedEnabled());
  private readonly _hoveredElement = signal<HTMLElement | null>(null);
  private readonly _activeKey = signal<string | null>(null);
  private readonly _isEditing = signal(false);
  private readonly _overlayRect = signal<DOMRect | null>(null);

  /** Whether inspect mode is active. When `false`, the app behaves normally. */
  readonly enabled = this._enabled.asReadonly();
  /** Element under the cursor that carries `[data-i18n-key]` (or `null`). */
  readonly hoveredElement = this._hoveredElement.asReadonly();
  /** Translation key of the hovered/active element (or `null`). */
  readonly activeKey = this._activeKey.asReadonly();
  /** Whether the floating editor is currently open. */
  readonly isEditing = this._isEditing.asReadonly();
  /** Bounding box used to position the overlay and editor. */
  readonly overlayRect = this._overlayRect.asReadonly();

  /**
   * Turn inspect mode on or off. The choice is persisted to `localStorage`.
   * Disabling also closes the editor and clears any hover so the overlays
   * vanish immediately and the host app regains normal interaction.
   */
  setEnabled(value: boolean): void {
    this._enabled.set(value);
    this.persistEnabled(value);
    if (!value) {
      this.closeEditor();
    }
  }

  /** Flip inspect mode between on and off. */
  toggle(): void {
    this.setEnabled(!this._enabled());
  }

  /** Record the element currently being hovered, with its key and box. */
  setHoveredElement(element: HTMLElement, key: string, rect: DOMRect): void {
    this._hoveredElement.set(element);
    this._activeKey.set(key);
    this._overlayRect.set(rect);
  }

  /** Clear hover state. Does nothing while the editor is open. */
  clearHovered(): void {
    if (this._isEditing()) {
      return;
    }
    this._hoveredElement.set(null);
    this._activeKey.set(null);
    this._overlayRect.set(null);
  }

  /**
   * Open the editor for the element currently hovered. The active key and rect
   * are already captured by {@link setHoveredElement}, so this just flips the
   * editing flag (when there is something to edit).
   */
  openEditor(): void {
    if (this._activeKey() === null) {
      return;
    }
    this._isEditing.set(true);
  }

  /** Close the editor and reset the active selection. */
  closeEditor(): void {
    this._isEditing.set(false);
    this._hoveredElement.set(null);
    this._activeKey.set(null);
    this._overlayRect.set(null);
  }

  /** Read the persisted on/off choice; defaults to `false` (disabled). */
  private readPersistedEnabled(): boolean {
    try {
      return this.window?.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      // Storage can be unavailable (privacy mode, SSR) — stay disabled.
      return false;
    }
  }

  private persistEnabled(value: boolean): void {
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage write failures — persistence is best-effort.
    }
  }
}
