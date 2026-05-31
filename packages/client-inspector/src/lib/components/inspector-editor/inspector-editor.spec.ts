import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectorStateService } from '../../state/inspector-state.service';
import { InspectorEditor } from './inspector-editor';

describe('InspectorEditor', () => {
  let fixture: ComponentFixture<InspectorEditor>;
  let state: InspectorStateService;
  let target: HTMLElement;

  const panel = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('.li18n-editor');
  const textarea = (): HTMLTextAreaElement =>
    fixture.nativeElement.querySelector('.li18n-editor__input');
  const keyEl = (): HTMLElement =>
    fixture.nativeElement.querySelector('.li18n-editor__key');
  const button = (label: string): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('.li18n-btn')].find(
      (b) => (b as HTMLElement).textContent?.trim() === label,
    ) as HTMLButtonElement;

  /** Type `value` into the textarea and let the framework settle. */
  async function type(value: string): Promise<void> {
    const input = textarea();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }

  /** Open the editor against a translatable element with the given text. */
  async function openEditorFor(text: string): Promise<void> {
    target = document.createElement('h1');
    target.textContent = text;
    document.body.appendChild(target);
    state.setHoveredElement(target, 'demo.title', new DOMRect(0, 0, 100, 20));
    state.openEditor();
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    state = TestBed.inject(InspectorStateService);
    fixture = TestBed.createComponent(InspectorEditor);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders nothing when not editing', async () => {
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('shows the active key and seeds the textarea from the element text', async () => {
    await openEditorFor('Hello, World!');

    expect(panel()).not.toBeNull();
    expect(keyEl().textContent).toContain('demo.title');
    expect(textarea().value).toBe('Hello, World!');
  });

  it('live-previews the draft into the real element as the user types', async () => {
    await openEditorFor('Hello, World!');

    await type('Hola, Mundo!');

    expect(target.textContent).toBe('Hola, Mundo!');
  });

  it('reverts the element text and closes when Cancel is clicked', async () => {
    await openEditorFor('Hello, World!');
    await type('Throwaway edit');

    button('Cancel').click();
    await fixture.whenStable();

    expect(target.textContent).toBe('Hello, World!');
    expect(state.isEditing()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('keeps the previewed text, logs, and closes when Save is clicked', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await openEditorFor('Hello, World!');
    await type('Saved value');

    button('Save').click();
    await fixture.whenStable();

    expect(target.textContent).toBe('Saved value');
    expect(state.isEditing()).toBe(false);
    expect(log).toHaveBeenCalledWith('[live-i18n] save', {
      key: 'demo.title',
      value: 'Saved value',
    });
  });

  it('closes and reverts on Escape', async () => {
    await openEditorFor('Hello, World!');
    await type('Discard me');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(target.textContent).toBe('Hello, World!');
    expect(state.isEditing()).toBe(false);
    expect(panel()).toBeNull();
  });
});
