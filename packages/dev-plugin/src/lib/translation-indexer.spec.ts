import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TranslationIndexer, type IndexerLogger } from './translation-indexer.js';

/** Logger that records every message so tests can assert on warnings. */
function recordingLogger(): IndexerLogger & { warns: string[]; infos: string[] } {
  const warns: string[] = [];
  const infos: string[] = [];
  return {
    warns,
    infos,
    warn: (m) => warns.push(m),
    info: (m) => infos.push(m),
  };
}

function write(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

describe('TranslationIndexer', () => {
  let root: string;
  let assetsDir: string;
  let featuresDir: string;
  let authFile: string;
  let assetsEn: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'live-i18n-idx-'));
    assetsDir = join(root, 'assets', 'i18n');
    featuresDir = join(root, 'features');
    assetsEn = join(assetsDir, 'en.json');
    authFile = join(featuresDir, 'auth', 'i18n', 'en.json');

    write(assetsEn, JSON.stringify({ nav: { brand: 'Brand' } }));
    // Feature file holds a unique key AND a duplicate of nav.brand.
    write(authFile, JSON.stringify({ auth: { login: 'Log in' }, nav: { brand: 'Dup' } }));
    // Unparseable file — must be skipped, not crash the build.
    write(join(featuresDir, 'cart', 'i18n', 'en.json'), '{ not valid json');
    // Excluded by directory filter.
    write(join(featuresDir, 'node_modules', 'pkg', 'en.json'), JSON.stringify({ x: 'y' }));
    // Non-locale filenames — never indexed (stems aren't locale codes).
    write(join(assetsDir, 'messages.json'), JSON.stringify({ a: 'b' }));
    write(join(assetsDir, 'package.json'), JSON.stringify({ name: 'x' }));
    write(join(assetsDir, 'tsconfig.json'), JSON.stringify({ files: [] }));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('indexes keys from multiple roots and resolves them to their files', () => {
    const logger = recordingLogger();
    const indexer = TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [assetsDir, featuresDir],
      logger,
    });

    expect(indexer.resolve('en', 'auth.login')).toBe(authFile);
    expect(indexer.resolve('en', 'nav.brand')).toBe(assetsEn); // first root wins
    expect(indexer.resolve('en', 'missing.key')).toBeUndefined();
  });

  it('warns and skips duplicate keys (first-found-wins)', () => {
    const logger = recordingLogger();
    TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [assetsDir, featuresDir],
      logger,
    });

    expect(logger.warns.some((w) => w.includes('duplicate key "nav.brand"'))).toBe(true);
  });

  it('warns and skips unparseable files without crashing', () => {
    const logger = recordingLogger();
    const indexer = TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [featuresDir],
      logger,
    });

    expect(logger.warns.some((w) => w.includes('cart'))).toBe(true);
    expect(indexer.resolve('en', 'auth.login')).toBe(authFile); // others still indexed
  });

  it('excludes node_modules and non-locale filenames', () => {
    const indexer = TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [assetsDir, featuresDir],
      logger: recordingLogger(),
    });

    expect(indexer.resolve('en', 'x')).toBeUndefined(); // node_modules/pkg/en.json
    expect(indexer.resolve('messages', 'a')).toBeUndefined(); // messages.json not a locale
    expect(indexer.resolve('package', 'name')).toBeUndefined(); // package.json excluded
    expect(indexer.resolve('tsconfig', 'files')).toBeUndefined(); // tsconfig.json excluded
  });

  it('warns on a missing search root but keeps going', () => {
    const logger = recordingLogger();
    const indexer = TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [join(root, 'does-not-exist'), assetsDir],
      logger,
    });

    expect(logger.warns.some((w) => w.includes('search root not found'))).toBe(true);
    expect(indexer.resolve('en', 'nav.brand')).toBe(assetsEn);
  });

  it('record() then resolve() round-trips a new key', () => {
    const indexer = TranslationIndexer.build({
      workspaceRoot: root,
      searchRoots: [assetsDir],
      logger: recordingLogger(),
    });

    indexer.record('fr', 'brand.new', join(assetsDir, 'fr.json'));
    expect(indexer.resolve('fr', 'brand.new')).toBe(join(assetsDir, 'fr.json'));
  });
});
