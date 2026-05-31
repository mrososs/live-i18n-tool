import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_TRANSLATIONS_CONFIG } from '../../config/live-translations.config';
import { InspectorStateService } from '../../state/inspector-state.service';
import { InspectorEditor } from './inspector-editor';

describe('InspectorEditor', () => {
  let fixture: ComponentFixture<InspectorEditor>;
  let state: InspectorStateService;
  let target: HTMLElement;
  /** Mutable per-test dictionary returned by the config's getTranslations. */
  let translations: Record<string, unknown>;

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
    // Raw value carries an interpolation placeholder the DOM never renders, so
    // tests can prove the textarea seeds from the dictionary, not the DOM text.
    translations = { demo: { title: 'Hello, {{name}}!' } };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: LIVE_TRANSLATIONS_CONFIG,
          useValue: {
            getLocale: () => 'en',
            getTranslations: () => translations,
            endpoint: '/__live-i18n-update',
          },
        },
      ],
    });
    state = TestBed.inject(InspectorStateService);
    fixture = TestBed.createComponent(InspectorEditor);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders nothing when not editing', async () => {
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('shows the active key and seeds the textarea from the raw dictionary value', async () => {
    // The element renders the interpolated "Hello, World!", but the editor must
    // surface the canonical source string with its placeholder intact.
    await openEditorFor('Hello, World!');

    expect(panel()).not.toBeNull();
    expect(keyEl().textContent).toContain('demo.title');
    expect(textarea().value).toBe('Hello, {{name}}!');
  });

  it('falls back to the element text when the key is missing from the dictionary', async () => {
    translations = {};

    await openEditorFor('Switch language (en)');

    expect(textarea().value).toBe('Switch language (en)');
  });

  it('gives the textarea an id and name for accessibility', async () => {
    await openEditorFor('Hello, World!');

    expect(textarea().id).toBe('li18n-editor-input');
    expect(textarea().name).toBe('li18n-editor-input');
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

  it('keeps the previewed text, posts the edit, and closes when Save is clicked', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    await openEditorFor('Hello, World!');
    await type('Saved value');

    button('Save').click();
    await fixture.whenStable();

    expect(target.textContent).toBe('Saved value');
    expect(state.isEditing()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__live-i18n-update');
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body as string)).toEqual({
      key: 'demo.title',
      value: 'Saved value',
      lang: 'en',
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
