import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectorStateService } from '../state/inspector-state.service';
import { InspectorTrackingService } from './inspector-tracking.service';

/**
 * NOTE: Angular 21 ships the stable `provideZonelessChangeDetection()`. The
 * older `provideExperimentalZonelessChangeDetection()` was removed, so we use
 * the stable provider here.
 */
describe('InspectorTrackingService', () => {
  let tracking: InspectorTrackingService;
  let state: InspectorStateService;

  /** Build a translatable element, attach it to the DOM, return it. */
  function translatable(key: string, tag = 'div'): HTMLElement {
    const el = document.createElement(tag);
    el.setAttribute('data-i18n-key', key);
    document.body.appendChild(el);
    return el;
  }

  /** Force `requestAnimationFrame` to run its callback synchronously. */
  function runRafSynchronously(): void {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  }

  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    state = TestBed.inject(InspectorStateService);
    tracking = TestBed.inject(InspectorTrackingService);
    // Default is OFF; the interaction tests below exercise the enabled path.
    state.setEnabled(true);
  });

  afterEach(() => {
    tracking.destroy();
    document.body.innerHTML = '';
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Task 3.1 — Memory leak cleanup
  // ---------------------------------------------------------------------------
  describe('memory-leak cleanup', () => {
    it('removes every listener (by reference) and cancels the pending frame on destroy', () => {
      // Keep the scheduled frame pending so there is a real rafId to cancel.
      vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(777);
      const cancelRaf = vi.spyOn(window, 'cancelAnimationFrame');

      const winAdd = vi.spyOn(window, 'addEventListener');
      const winRemove = vi.spyOn(window, 'removeEventListener');
      const bodyAdd = vi.spyOn(document.body, 'addEventListener');
      const bodyRemove = vi.spyOn(document.body, 'removeEventListener');

      tracking.init();

      // Schedule an animation frame (so rafId === 777).
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      // Capture the exact handler references the service registered.
      const mousemoveHandler = bodyAdd.mock.calls.find((c) => c[0] === 'mousemove')?.[1];
      const clickHandler = bodyAdd.mock.calls.find((c) => c[0] === 'click')?.[1];
      const scrollHandler = winAdd.mock.calls.find((c) => c[0] === 'scroll')?.[1];
      const resizeHandler = winAdd.mock.calls.find((c) => c[0] === 'resize')?.[1];

      expect(mousemoveHandler).toBeTypeOf('function');
      expect(scrollHandler).toBeTypeOf('function');

      // Trigger the DestroyRef cleanup by destroying the injector.
      TestBed.resetTestingModule();

      // Window listeners removed with the SAME references.
      expect(winRemove).toHaveBeenCalledWith('scroll', scrollHandler, expect.anything());
      expect(winRemove).toHaveBeenCalledWith('resize', resizeHandler);
      // Body listeners removed with the SAME references.
      expect(bodyRemove).toHaveBeenCalledWith('mousemove', mousemoveHandler);
      expect(bodyRemove).toHaveBeenCalledWith('click', clickHandler, true);
      // Pending animation frame cancelled with the exact id.
      expect(cancelRaf).toHaveBeenCalledWith(777);
    });

    it('is idempotent: init() twice registers listeners only once', () => {
      const bodyAdd = vi.spyOn(document.body, 'addEventListener');

      tracking.init();
      tracking.init();

      const mousemoveCalls = bodyAdd.mock.calls.filter((c) => c[0] === 'mousemove');
      expect(mousemoveCalls).toHaveLength(1);
    });

    it('destroy() is safe to call when never started', () => {
      expect(() => tracking.destroy()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Task 3.2 — Scroll / resize resync
  // ---------------------------------------------------------------------------
  describe('scroll / resize resync', () => {
    it('re-measures the hovered element and updates overlayRect on scroll', () => {
      const el = translatable('demo.title');
      const before = new DOMRect(0, 0, 120, 24);
      const after = new DOMRect(0, -80, 120, 24);
      const getRect = vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(after);

      state.setHoveredElement(el, 'demo.title', before);
      tracking.init();

      window.dispatchEvent(new Event('scroll'));

      expect(getRect).toHaveBeenCalledTimes(1);
      expect(state.overlayRect()).toBe(after);
    });

    it('re-measures on resize too', () => {
      const el = translatable('demo.title');
      const after = new DOMRect(10, 10, 200, 30);
      const getRect = vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(after);

      state.setHoveredElement(el, 'demo.title', new DOMRect());
      tracking.init();

      window.dispatchEvent(new Event('resize'));

      expect(getRect).toHaveBeenCalledTimes(1);
      expect(state.overlayRect()).toBe(after);
    });

    it('keeps the editor anchored: resync still runs while editing', () => {
      const el = translatable('demo.title');
      const after = new DOMRect(0, -120, 120, 24);
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(after);

      state.setHoveredElement(el, 'demo.title', new DOMRect());
      state.openEditor();
      tracking.init();

      window.dispatchEvent(new Event('scroll'));

      expect(state.isEditing()).toBe(true);
      expect(state.overlayRect()).toBe(after);
    });

    it('does nothing on scroll when no element is hovered', () => {
      tracking.init();
      expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
      expect(state.overlayRect()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Task 3.3 — Aggressive click prevention
  // ---------------------------------------------------------------------------
  describe('aggressive click prevention', () => {
    it('swallows the click on a translatable <a> and opens the editor', () => {
      const anchor = translatable('demo.title', 'a');
      anchor.setAttribute('href', '#somewhere');
      tracking.init();

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefault = vi.spyOn(event, 'preventDefault');
      const stopPropagation = vi.spyOn(event, 'stopPropagation');
      const stopImmediate = vi.spyOn(event, 'stopImmediatePropagation');

      anchor.dispatchEvent(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
      expect(stopImmediate).toHaveBeenCalled();
      expect(state.isEditing()).toBe(true);
      expect(state.activeKey()).toBe('demo.title');
    });

    it("language-toggle scenario: the app's own click handler never fires", () => {
      // Reproduces the reported case — clicking the translated language-toggle
      // button must open the editor, NOT toggle the language.
      const button = translatable('demo.switchLanguage', 'button');
      const appHandler = vi.fn();
      button.addEventListener('click', appHandler);
      tracking.init();

      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(appHandler).not.toHaveBeenCalled();
      expect(state.isEditing()).toBe(true);
      expect(state.activeKey()).toBe('demo.switchLanguage');
    });

    it('resolves the key from a nested child via closest()', () => {
      const parent = translatable('demo.title');
      const child = document.createElement('span');
      parent.appendChild(child);
      tracking.init();

      child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(state.isEditing()).toBe(true);
      expect(state.activeKey()).toBe('demo.title');
    });

    it('ignores clicks on non-translatable elements', () => {
      const plain = document.createElement('button');
      document.body.appendChild(plain);
      const appHandler = vi.fn();
      plain.addEventListener('click', appHandler);
      tracking.init();

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefault = vi.spyOn(event, 'preventDefault');
      plain.dispatchEvent(event);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(appHandler).toHaveBeenCalledTimes(1);
      expect(state.isEditing()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled (inspect mode OFF) — the host app must behave normally
  // ---------------------------------------------------------------------------
  describe('when inspect mode is disabled', () => {
    beforeEach(() => {
      state.setEnabled(false);
    });

    it("does NOT hijack the click — the app's own handler runs (the toggle bug fix)", () => {
      const button = translatable('demo.switchLanguage', 'button');
      const appHandler = vi.fn();
      button.addEventListener('click', appHandler);
      tracking.init();

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefault = vi.spyOn(event, 'preventDefault');
      const stopImmediate = vi.spyOn(event, 'stopImmediatePropagation');
      button.dispatchEvent(event);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopImmediate).not.toHaveBeenCalled();
      expect(appHandler).toHaveBeenCalledTimes(1);
      expect(state.isEditing()).toBe(false);
    });

    it('does not track hover while disabled', () => {
      runRafSynchronously();
      const el = translatable('demo.title');
      tracking.init();

      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(state.hoveredElement()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Hover tracking
  // ---------------------------------------------------------------------------
  describe('hover tracking', () => {
    it('records the element + rect when hovering a translatable element', () => {
      runRafSynchronously();
      const el = translatable('demo.title');
      const rect = new DOMRect(5, 6, 50, 10);
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
      tracking.init();

      el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(state.hoveredElement()).toBe(el);
      expect(state.activeKey()).toBe('demo.title');
      expect(state.overlayRect()).toBe(rect);
    });

    it('clears hover when moving onto a non-translatable element', () => {
      runRafSynchronously();
      const el = translatable('demo.title');
      state.setHoveredElement(el, 'demo.title', new DOMRect());
      tracking.init();

      const plain = document.createElement('section');
      document.body.appendChild(plain);
      plain.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(state.hoveredElement()).toBeNull();
      expect(state.activeKey()).toBeNull();
    });

    it('coalesces rapid mousemoves into a single scheduled frame', () => {
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
      tracking.init();

      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(raf).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Editing locks the selection — hover must not re-target an open editor
  // ---------------------------------------------------------------------------
  describe('selection is locked while editing', () => {
    it('does NOT re-target on hover while the editor is open', () => {
      runRafSynchronously();
      const first = translatable('demo.title');
      const second = translatable('demo.greeting');
      state.setHoveredElement(first, 'demo.title', new DOMRect());
      state.openEditor();
      tracking.init();

      // Cursor travels over another translatable element (e.g. on its way to
      // the editor panel) — the selection must stay pinned to the first.
      second.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(state.isEditing()).toBe(true);
      expect(state.hoveredElement()).toBe(first);
      expect(state.activeKey()).toBe('demo.title');
    });

    it('does not even schedule a frame on hover while editing', () => {
      const raf = vi.spyOn(window, 'requestAnimationFrame');
      const first = translatable('demo.title');
      state.setHoveredElement(first, 'demo.title', new DOMRect());
      state.openEditor();
      tracking.init();

      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

      expect(raf).not.toHaveBeenCalled();
    });

    it('a click STILL re-targets the editor onto the pressed element', () => {
      const first = translatable('demo.title');
      const second = translatable('demo.greeting');
      state.setHoveredElement(first, 'demo.title', new DOMRect());
      state.openEditor();
      tracking.init();

      second.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );

      expect(state.isEditing()).toBe(true);
      expect(state.hoveredElement()).toBe(second);
      expect(state.activeKey()).toBe('demo.greeting');
    });
  });
});
