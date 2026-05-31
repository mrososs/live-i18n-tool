import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InspectorStateService } from '../../state/inspector-state.service';
import { InspectorToggle } from './inspector-toggle';

describe('InspectorToggle', () => {
  let fixture: ComponentFixture<InspectorToggle>;
  let state: InspectorStateService;

  const btn = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('.li18n-toggle');

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
    fixture = TestBed.createComponent(InspectorToggle);
  });

  afterEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('renders the floating button reflecting the disabled default', async () => {
    await fixture.whenStable();

    expect(btn()).not.toBeNull();
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    expect(btn().classList.contains('li18n-toggle--active')).toBe(false);
    expect(btn().textContent).toContain('OFF');
  });

  it('toggles inspect mode when clicked and reflects the active state', async () => {
    await fixture.whenStable();

    btn().click();
    await fixture.whenStable();

    expect(state.enabled()).toBe(true);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    expect(btn().classList.contains('li18n-toggle--active')).toBe(true);
    expect(btn().textContent).toContain('ON');
  });

  it('toggles via the Alt+Shift+I keyboard shortcut', async () => {
    await fixture.whenStable();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'i',
        altKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    await fixture.whenStable();

    expect(state.enabled()).toBe(true);
  });
});
