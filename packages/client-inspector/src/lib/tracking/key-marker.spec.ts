import { describe, expect, it } from 'vitest';
import {
  enableKeyMarkers,
  readKeyMarker,
  wrapValueWithKey,
  type TranslatePipeLike,
} from './key-marker';

const DELIM = String.fromCharCode(0x200b);
const BIT0 = String.fromCharCode(0x2060);
const BIT1 = String.fromCharCode(0x2061);

describe('key-marker', () => {
  it('round-trips a key through wrap then read', () => {
    const wrapped = wrapValueWithKey('hero.title', 'Hello world');
    expect(wrapped).toContain('Hello world');

    const decoded = readKeyMarker(wrapped);
    expect(decoded).toEqual({ key: 'hero.title', rest: 'Hello world' });
  });

  it('keeps the marker invisible (only zero-width chars added)', () => {
    const wrapped = wrapValueWithKey('a.b', 'Visible');
    const prefix = wrapped.slice(0, wrapped.indexOf('Visible'));
    const markerOnly = new RegExp('^[' + DELIM + BIT0 + BIT1 + ']+$');
    expect(markerOnly.test(prefix)).toBe(true);
  });

  it('disambiguates two different keys that render identical text', () => {
    const a = wrapValueWithKey('nav.getStarted', 'Get started');
    const b = wrapValueWithKey('hero.ctaPrimary', 'Get started');

    expect(a).not.toEqual(b);
    expect(readKeyMarker(a)?.key).toBe('nav.getStarted');
    expect(readKeyMarker(b)?.key).toBe('hero.ctaPrimary');
  });

  it('finds a marker preceded by whitespace and preserves it', () => {
    // Angular can render ` <marker>Save ` around an interpolation.
    const wrapped = wrapValueWithKey('cta.button', 'Save');
    const padded = ' ' + wrapped + ' ';

    const decoded = readKeyMarker(padded);
    expect(decoded).toEqual({ key: 'cta.button', rest: ' Save ' });
  });

  it('returns null for un-marked text', () => {
    expect(readKeyMarker('just plain text')).toBeNull();
    expect(readKeyMarker('')).toBeNull();
  });

  it('returns null for a corrupted marker with no valid id bits', () => {
    expect(readKeyMarker(DELIM + DELIM + 'plain')).toBeNull();
  });

  describe('enableKeyMarkers', () => {
    function makePipe(): TranslatePipeLike & {
      prototype: { transform: (q: unknown, ...a: unknown[]) => unknown };
    } {
      return {
        prototype: {
          transform(query: unknown): unknown {
            return typeof query === 'string' ? 'value:' + query : query;
          },
        },
      };
    }

    it('wraps string output with the query key', () => {
      const pipe = makePipe();
      enableKeyMarkers(pipe);

      const out = pipe.prototype.transform('faq.q1.q') as string;
      expect(readKeyMarker(out)).toEqual({
        key: 'faq.q1.q',
        rest: 'value:faq.q1.q',
      });
    });

    it('passes non-string results through untouched', () => {
      const pipe = makePipe();
      enableKeyMarkers(pipe);

      expect(pipe.prototype.transform(42)).toBe(42);
    });

    it('is idempotent', () => {
      const pipe = makePipe();
      enableKeyMarkers(pipe);
      const once = pipe.prototype.transform;
      enableKeyMarkers(pipe);
      expect(pipe.prototype.transform).toBe(once);
    });

    it('is a no-op when disabled', () => {
      const disabled = makePipe();
      enableKeyMarkers(disabled, false);
      expect(disabled.prototype.transform('x')).toBe('value:x');
    });
  });
});
