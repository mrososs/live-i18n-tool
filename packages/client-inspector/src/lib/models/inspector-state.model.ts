/**
 * Snapshot of the inspector's reactive state.
 *
 * All coordinates in `overlayRect` are viewport-relative (from
 * `getBoundingClientRect()`), matching the `position: fixed` overlay.
 */
export interface InspectorState {
  /** The element currently under the cursor that carries `[data-i18n-key]`. */
  hoveredElement: HTMLElement | null;
  /** The translation key extracted from the hovered/active element. */
  activeKey: string | null;
  /** Whether the floating editor is open. */
  isEditing: boolean;
  /** Bounding box of the hovered/active element, used to position overlays. */
  overlayRect: DOMRect | null;
}
