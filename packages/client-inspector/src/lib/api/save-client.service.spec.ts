import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVE_TRANSLATIONS_CONFIG } from '../config/live-translations.config';
import { SaveClient } from './save-client.service';

describe('SaveClient', () => {
  function setup(locale = 'ar', endpoint = '/__live-i18n-update'): SaveClient {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: LIVE_TRANSLATIONS_CONFIG,
          useValue: {
            getLocale: () => locale,
            getTranslations: () => ({}),
            endpoint,
          },
        },
      ],
    });
    return TestBed.inject(SaveClient);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs { key, value, lang } to the configured endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const client = setup('ar', '/__save');
    const result = await client.save('demo.title', 'مرحبا');

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__save');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      key: 'demo.title',
      value: 'مرحبا',
      lang: 'ar',
    });
  });

  it('reports a failed response without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as unknown as Response),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await setup().save('missing.key', 'x');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('reports a network error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await setup().save('demo.title', 'x');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('offline');
  });
});
