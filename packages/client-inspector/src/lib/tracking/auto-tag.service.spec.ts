import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIVE_TRANSLATIONS_CONFIG } from '../config/live-translations.config';
import { AutoTagService } from './auto-tag.service';

describe('AutoTagService', () => {
  let translations: Record<string, unknown>;

  function setup(): AutoTagService {
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
    return TestBed.inject(AutoTagService);
  }

  function element(tag: string, text: string): HTMLElement {
    const el = document.createElement(tag);
    el.textContent = text;
    document.body.appendChild(el);
    return el;
  }

  beforeEach(() => {
    translations = {};
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('tags an element whose text exactly matches a nested translation value', () => {
    translations = { demo: { title: 'Hello, World!' } };
    const h1 = element('h1', 'Hello, World!');

    setup().init();

    expect(h1.getAttribute('data-i18n-key')).toBe('demo.title');
  });

  it('matches interpolated values via a wildcard', () => {
    translations = { demo: { greeting: 'Hello, {{name}}!' } };
    const p = element('p', 'Hello, Mohamed!');

    setup().init();

    expect(p.getAttribute('data-i18n-key')).toBe('demo.greeting');
  });

  it('leaves elements that already carry a key untouched', () => {
    translations = { demo: { title: 'Hello, World!' } };
    const h1 = element('h1', 'Hello, World!');
    h1.setAttribute('data-i18n-key', 'manual.key');

    setup().init();

    expect(h1.getAttribute('data-i18n-key')).toBe('manual.key');
  });

  it('does not tag text that matches no translation', () => {
    translations = { demo: { title: 'Hello, World!' } };
    const span = element('span', 'Untranslated text');

    setup().init();

    expect(span.hasAttribute('data-i18n-key')).toBe(false);
  });
});
