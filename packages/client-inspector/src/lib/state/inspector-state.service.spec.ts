import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InspectorStateService } from './inspector-state.service';

const STORAGE_KEY = 'live-i18n:enabled';

describe('InspectorStateService', () => {
  let service: InspectorStateService;

  function freshService(): InspectorStateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(InspectorStateService);
  }

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(InspectorStateService);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('enabled / inspect mode', () => {
    it('defaults to disabled', () => {
      expect(service.enabled()).toBe(false);
    });

    it('toggle() flips enabled', () => {
      service.toggle();
      expect(service.enabled()).toBe(true);
      service.toggle();
      expect(service.enabled()).toBe(false);
    });

    it('persists the choice to localStorage', () => {
      service.setEnabled(true);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
      service.setEnabled(false);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false');
    });

    it('seeds the initial value from localStorage', () => {
      window.localStorage.setItem(STORAGE_KEY, 'true');
      expect(freshService().enabled()).toBe(true);
    });

    it('closes the editor and clears hover when disabled', () => {
      service.setEnabled(true);
      service.setHoveredElement(document.createElement('div'), 'demo.title', new DOMRect());
      service.openEditor();
      expect(service.isEditing()).toBe(true);

      service.setEnabled(false);

      expect(service.isEditing()).toBe(false);
      expect(service.hoveredElement()).toBeNull();
      expect(service.activeKey()).toBeNull();
    });
  });

  it('records the hovered element, key and rect', () => {
    const el = document.createElement('div');
    const rect = el.getBoundingClientRect();

    service.setHoveredElement(el, 'demo.title', rect);

    expect(service.hoveredElement()).toBe(el);
    expect(service.activeKey()).toBe('demo.title');
    expect(service.overlayRect()).toBe(rect);
  });

  it('opens the editor only when a key is active', () => {
    service.openEditor();
    expect(service.isEditing()).toBe(false);

    service.setHoveredElement(
      document.createElement('div'),
      'demo.title',
      new DOMRect(),
    );
    service.openEditor();
    expect(service.isEditing()).toBe(true);
  });

  it('does not clear hover while editing', () => {
    const el = document.createElement('div');
    service.setHoveredElement(el, 'demo.title', new DOMRect());
    service.openEditor();

    service.clearHovered();

    expect(service.hoveredElement()).toBe(el);
  });

  it('resets all state on close', () => {
    service.setHoveredElement(
      document.createElement('div'),
      'demo.title',
      new DOMRect(),
    );
    service.openEditor();

    service.closeEditor();

    expect(service.isEditing()).toBe(false);
    expect(service.hoveredElement()).toBeNull();
    expect(service.activeKey()).toBeNull();
    expect(service.overlayRect()).toBeNull();
  });
});
