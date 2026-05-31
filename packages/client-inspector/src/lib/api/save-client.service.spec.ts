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

  /** Builds a minimal `Response` stub matching how `save()` reads the body. */
  function mockFetchResponse(init: {
    ok: boolean;
    status: number;
    body?: string;
  }): Response {
    return {
      ok: init.ok,
      status: init.status,
      text: async () => init.body ?? '',
    } as unknown as Response;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('POSTs { key, value, lang } to the configured endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockFetchResponse({ ok: true, status: 200, body: '{"ok":true}' }),
      );
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

  it('flags a 404 (no plugin route) as plugin-unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse({ ok: false, status: 404, body: '<h1>Not Found</h1>' }),
        ),
    );
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await setup().save('missing.key', 'x');

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('plugin-unavailable');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('@live-i18n/plugin');
  });

  it('flags a 200 SPA fallback (index.html) as plugin-unavailable', async () => {
    // The core silent-data-loss bug: the bare dev server answers POSTs with the
    // SPA index.html at 200, which must NOT be treated as a successful save.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: '<!doctype html><html><body>app</body></html>',
        }),
      ),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await setup().save('demo.title', 'x');

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('plugin-unavailable');
  });

  it('surfaces a server error from the plugin JSON contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 404,
          body: '{"ok":false,"error":"Translation file not found: ar.json"}',
        }),
      ),
    );
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await setup('ar').save('demo.title', 'x');

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('server-error');
    expect(result.error).toBe('Translation file not found: ar.json');
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      'Translation file not found: ar.json',
    );
  });

  it('reports a network error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await setup().save('demo.title', 'x');

    expect(result.ok).toBe(false);
    expect(result.kind).toBe('network-error');
    expect(result.error).toBe('offline');
  });
});
