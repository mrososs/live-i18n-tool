import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TranslationFileError,
  updateTranslationFile,
  writeTranslationAtPath,
} from './update-translation-file.js';

describe('writeTranslationAtPath', () => {
  let root: string;
  let enPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'live-i18n-write-'));
    enPath = join(root, 'en.json');
    // 4-space indent, trailing newline.
    writeFileSync(enPath, '{\n    "nav": {\n        "brand": "Old"\n    }\n}\n', 'utf8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('updates a nested key, preserving indentation and trailing newline', () => {
    writeTranslationAtPath(enPath, 'en', 'nav.brand', 'New', { allowedRoots: [root] });

    const written = readFileSync(enPath, 'utf8');
    expect(written).toBe('{\n    "nav": {\n        "brand": "New"\n    }\n}\n');
  });

  it('rejects a path outside the allowed roots (400)', () => {
    const outside = join(root, '..', 'escape.json');
    expect.assertions(2);
    try {
      writeTranslationAtPath(outside, 'en', 'a.b', 'x', { allowedRoots: [root] });
    } catch (error) {
      expect(error).toBeInstanceOf(TranslationFileError);
      expect((error as TranslationFileError).status).toBe(400);
    }
  });

  it('rejects a non-.json path (400)', () => {
    const notJson = join(root, 'en.txt');
    writeFileSync(notJson, '{}', 'utf8');
    try {
      writeTranslationAtPath(notJson, 'en', 'a.b', 'x', { allowedRoots: [root] });
      expect.unreachable();
    } catch (error) {
      expect((error as TranslationFileError).status).toBe(400);
    }
  });

  it('rejects prototype-polluting key segments (400)', () => {
    try {
      writeTranslationAtPath(enPath, 'en', 'a.__proto__.b', 'x', { allowedRoots: [root] });
      expect.unreachable();
    } catch (error) {
      expect((error as TranslationFileError).status).toBe(400);
    }
  });

  it('rejects keys with empty segments such as ".." (400)', () => {
    try {
      writeTranslationAtPath(enPath, 'en', '..', 'x', { allowedRoots: [root] });
      expect.unreachable();
    } catch (error) {
      expect((error as TranslationFileError).status).toBe(400);
    }
  });

  it('404s when the target file does not exist', () => {
    try {
      writeTranslationAtPath(join(root, 'fr.json'), 'fr', 'a.b', 'x', { allowedRoots: [root] });
      expect.unreachable();
    } catch (error) {
      expect((error as TranslationFileError).status).toBe(404);
    }
  });
});

describe('updateTranslationFile (back-compat wrapper)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'live-i18n-compat-'));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'en.json'), '{\n  "a": "1"\n}\n', 'utf8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes <basePath>/<lang>.json as before', () => {
    updateTranslationFile(root, 'en', 'a', '2');
    expect(readFileSync(join(root, 'en.json'), 'utf8')).toBe('{\n  "a": "2"\n}\n');
  });

  it('rejects an invalid locale (400)', () => {
    try {
      updateTranslationFile(root, '../evil', 'a', '2');
      expect.unreachable();
    } catch (error) {
      expect((error as TranslationFileError).status).toBe(400);
    }
  });
});
