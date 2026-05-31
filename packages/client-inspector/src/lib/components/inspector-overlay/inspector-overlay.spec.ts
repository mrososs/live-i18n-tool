import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { InspectorStateService } from '../../state/inspector-state.service';
import { InspectorOverlay } from './inspector-overlay';

describe('InspectorOverlay', () => {
  let fixture: ComponentFixture<InspectorOverlay>;
  let state: InspectorStateService;

  const overlay = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.li18n-overlay');

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
    state.setEnabled(true);
    fixture = TestBed.createComponent(InspectorOverlay);
  });

  it('renders nothing when no element is hovered', async () => {
    await fixture.whenStable();
    expect(overlay()).toBeNull();
  });

  it('renders a box positioned from the overlay rect while hovering', async () => {
    const el = document.createElement('div');
    state.setHoveredElement(el, 'demo.title', new DOMRect(12, 34, 100, 20));

    await fixture.whenStable();

    const box = overlay();
    expect(box).not.toBeNull();
    expect(box!.style.top).toBe('34px');
    expect(box!.style.left).toBe('12px');
    expect(box!.style.width).toBe('100px');
    expect(box!.style.height).toBe('20px');
  });

  it('hides the box while the editor is open', async () => {
    state.setHoveredElement(document.createElement('div'), 'demo.title', new DOMRect());
    await fixture.whenStable();
    expect(overlay()).not.toBeNull();

    state.openEditor();
    await fixture.whenStable();
    expect(overlay()).toBeNull();
  });

  it('hides the box when inspect mode is disabled', async () => {
    state.setHoveredElement(document.createElement('div'), 'demo.title', new DOMRect());
    await fixture.whenStable();
    expect(overlay()).not.toBeNull();

    state.setEnabled(false);
    await fixture.whenStable();
    expect(overlay()).toBeNull();
  });
});
