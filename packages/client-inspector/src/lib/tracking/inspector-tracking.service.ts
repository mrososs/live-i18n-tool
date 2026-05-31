import { DestroyRef, inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { InspectorStateService } from '../state/inspector-state.service';

/** Attribute used to mark a translatable element. */
const I18N_KEY_ATTR = 'data-i18n-key';
const I18N_KEY_SELECTOR = `[${I18N_KEY_ATTR}]`;

/** Capture + passive so scroll resync runs early and never blocks scrolling. */
const SCROLL_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/**
 * Globally tracks the cursor with a single `mousemove` listener and intercepts
 * clicks on translatable elements. Hover work is throttled to one pass per
 * animation frame so fast cursor movement never floods change detection.
 *
 * It also keeps the overlay glued to its element while the page scrolls or
 * resizes, and aggressively swallows clicks on translatable elements so the
 * host application's own handlers (navigation, form submit, language toggle…)
 * never fire while you are editing.
 */
@Injectable({ providedIn: 'root' })
export class InspectorTrackingService {
  private readonly document = inject(DOCUMENT);
  private readonly state = inject(InspectorStateService);

  private rafId: number | null = null;
  private lastEvent: MouseEvent | null = null;
  private started = false;

  constructor() {
    // Guarantee teardown when the owning injector is destroyed — no zombie
    // listeners or animation-frame loops survive the service.
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  /** Attach the global listeners. Idempotent — safe to call more than once. */
  init(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const body = this.document.body;
    const view = this.document.defaultView;

    body.addEventListener('mousemove', this.onMouseMove, { passive: true });
    body.addEventListener('click', this.onClick, true);
    view?.addEventListener('scroll', this.onViewportChange, SCROLL_OPTIONS);
    view?.addEventListener('resize', this.onViewportChange);
  }

  /** Remove every listener and cancel any pending frame. */
  destroy(): void {
    if (!this.started) {
      return;
    }
    this.started = false;

    const body = this.document.body;
    const view = this.document.defaultView;

    body.removeEventListener('mousemove', this.onMouseMove);
    body.removeEventListener('click', this.onClick, true);
    view?.removeEventListener('scroll', this.onViewportChange, SCROLL_OPTIONS);
    view?.removeEventListener('resize', this.onViewportChange);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastEvent = null;
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    // Ignore hover while disabled, or while the editor is open: an open editor
    // pins its target so the cursor can travel to the panel (passing over other
    // translatable elements) without re-targeting. Only a click switches — see
    // onClick.
    if (!this.state.enabled() || this.state.isEditing()) {
      return;
    }
    // Coalesce: remember only the latest event, process once per frame.
    this.lastEvent = event;
    if (this.rafId !== null) {
      return;
    }
    this.rafId = requestAnimationFrame(this.processMove);
  };

  private readonly processMove = (): void => {
    this.rafId = null;
    const event = this.lastEvent;
    this.lastEvent = null;
    // Re-check isEditing: a frame may have been scheduled just before the editor
    // opened. While editing, leave the selection untouched (clearHovered is a
    // no-op then, so the active element stays put).
    if (!event || !this.state.enabled() || this.state.isEditing()) {
      this.state.clearHovered();
      return;
    }

    const target = event.target as HTMLElement | null;
    const match = target?.closest<HTMLElement>(I18N_KEY_SELECTOR) ?? null;

    if (match) {
      const key = match.getAttribute(I18N_KEY_ATTR);
      if (key) {
        this.state.setHoveredElement(match, key, match.getBoundingClientRect());
        return;
      }
    }
    this.state.clearHovered();
  };

  /**
   * Re-measure the active element so the overlay/editor stays glued to it while
   * the viewport scrolls or resizes (the box uses `position: fixed`, so its
   * coordinates drift the moment the page moves underneath it).
   */
  private readonly onViewportChange = (): void => {
    const element = this.state.hoveredElement();
    const key = this.state.activeKey();
    if (!element || key === null) {
      return;
    }
    this.state.setHoveredElement(element, key, element.getBoundingClientRect());
  };

  private readonly onClick = (event: MouseEvent): void => {
    // When inspect mode is off, never interfere — the host app's own handlers
    // (navigation, form submit, language toggle…) must run normally.
    if (!this.state.enabled()) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const match = target?.closest<HTMLElement>(I18N_KEY_SELECTOR) ?? null;
    if (!match) {
      return;
    }

    const key = match.getAttribute(I18N_KEY_ATTR);
    if (!key) {
      return;
    }

    // Aggressively swallow the click so NO app handler runs: no navigation, no
    // form submit, no language toggle — clicking a label only opens the editor.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    this.state.setHoveredElement(match, key, match.getBoundingClientRect());
    this.state.openEditor();
  };
}
