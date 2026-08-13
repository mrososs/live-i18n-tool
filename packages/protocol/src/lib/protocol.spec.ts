import { describe, expect, it } from 'vitest';
import {
  assertReviewerSeparation,
  canTransitionChangeSet,
  createApprovedChangeManifest,
  createJsonPatches,
  LIVE_I18N_PROTOCOL_VERSION,
  parseApprovedChangeManifest,
  parseLiveI18nProjectConfig,
  ProtocolValidationError,
  runDeterministicQa,
  type ChangeSet,
} from './protocol.js';

const approved: ChangeSet = {
  protocolVersion: LIVE_I18N_PROTOCOL_VERSION,
  id: 'change-set-1',
  projectId: 'project-1',
  environmentId: 'staging',
  baseRevision: 'build-123',
  catalogSnapshotId: 'catalog-1',
  authorId: 'editor-1',
  status: 'approved',
  revision: 3,
  entries: [
    {
      id: 'entry-1',
      locale: 'en',
      filePath: 'src/assets/i18n/en.json',
      key: 'checkout.title',
      keySegments: ['checkout', 'title'],
      jsonPointer: '/checkout/title',
      originalValue: 'Checkout',
      newValue: 'Complete your order',
      originalValueRevision: 'value-revision',
      revision: 1,
      requiredLocaleState: 'current',
    },
  ],
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T01:00:00.000Z',
};

describe('Pilot protocol', () => {
  it('validates the nested JSON file allowlist', () => {
    const config = parseLiveI18nProjectConfig({
      schemaVersion: 1,
      projectId: 'checkout',
      environmentId: 'staging',
      sourceLocale: 'en',
      requiredLocales: ['ar'],
      keyMode: 'nested',
      files: {
        en: ['src/assets/i18n/en.json'],
        ar: ['src/assets/i18n/ar.json'],
      },
    });

    expect(config.keyMode).toBe('nested');
    expect(() =>
      parseLiveI18nProjectConfig({
        ...config,
        files: { ...config.files, ar: ['../outside.json'] },
      }),
    ).toThrowError(ProtocolValidationError);
  });

  it('allows only the review state machine transitions', () => {
    expect(canTransitionChangeSet('draft', 'submitted')).toBe(true);
    expect(canTransitionChangeSet('submitted', 'approved')).toBe(true);
    expect(canTransitionChangeSet('approved', 'draft')).toBe(false);
  });

  it('prevents self review', () => {
    expect(() => assertReviewerSeparation('user-1', 'user-1')).toThrowError(
      ProtocolValidationError,
    );
  });

  it('catches deterministic blockers', () => {
    const issues = runDeterministicQa({
      entryId: 'entry-1',
      sourceValue: 'Hello, {{name}} <strong>today</strong>',
      targetValue: ' Hello <em>today</em> ',
      required: true,
      requiredLocaleState: 'outdated',
      characterLimit: 10,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'required_locale_outdated',
        'character_limit',
        'placeholder_mismatch',
        'html_mismatch',
        'unsafe_whitespace',
      ]),
    );
  });

  it('exports only approved entries as test-and-replace patches', () => {
    const manifest = createApprovedChangeManifest({
      changeSet: approved,
      configHash: 'config-hash',
      approvedAt: '2026-08-13T02:00:00.000Z',
    });

    expect(parseApprovedChangeManifest(manifest)).toEqual(manifest);
    expect(createJsonPatches(manifest)).toEqual({
      'src/assets/i18n/en.json': [
        { op: 'test', path: '/checkout/title', value: 'Checkout' },
        {
          op: 'replace',
          path: '/checkout/title',
          value: 'Complete your order',
        },
      ],
    });
  });

  it('refuses export before approval', () => {
    expect(() =>
      createApprovedChangeManifest({
        changeSet: { ...approved, status: 'submitted' },
        configHash: 'config-hash',
        approvedAt: '2026-08-13T02:00:00.000Z',
      }),
    ).toThrowError(ProtocolValidationError);
  });
});
