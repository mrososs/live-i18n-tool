import { describe, expect, it } from 'vitest';
import { flattenTranslations } from './flatten-translations.js';

describe('flattenTranslations', () => {
  it('flattens nested objects into dotted keys', () => {
    const flat = flattenTranslations({
      AUTH: { LOGIN: 'Log in', LOGOUT: 'Log out' },
      nav: { brand: 'Live i18n' },
    });

    expect(flat.get('AUTH.LOGIN')).toBe('Log in');
    expect(flat.get('AUTH.LOGOUT')).toBe('Log out');
    expect(flat.get('nav.brand')).toBe('Live i18n');
    expect(flat.size).toBe(3);
  });

  it('ignores arrays and non-string leaves', () => {
    const flat = flattenTranslations({
      keep: 'yes',
      list: ['a', 'b'],
      count: 3,
      nope: null,
      nested: { also: true },
    });

    expect([...flat.keys()]).toEqual(['keep']);
  });

  it('matches the playground feature dictionary shape', () => {
    const flat = flattenTranslations({
      features: { inContext: { title: 'In-context editing' } },
    });

    expect(flat.get('features.inContext.title')).toBe('In-context editing');
  });
});
