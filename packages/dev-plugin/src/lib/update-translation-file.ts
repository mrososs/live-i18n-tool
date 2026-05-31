import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/**
 * Error carrying the HTTP status the save middleware should respond with.
 */
export class TranslationFileError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TranslationFileError';
  }
}

/** Locale codes are restricted to safe filename characters (path-traversal guard). */
const LOCALE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Key segments that would enable prototype pollution. */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/** Infer the indentation used by an existing JSON document (defaults to two spaces). */
function detectIndent(source: string): string {
  const match = source.match(/^[ \t]*[{[][^\n]*\r?\n([ \t]+)/);
  return match ? match[1] : '  ';
}

/** Assign `value` at the dotted `segments` path, creating intermediate objects. */
function setDeep(
  target: Record<string, unknown>,
  segments: string[],
  value: string,
): void {
  let node = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const next = node[segment];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
}

/**
 * Rewrite a single translation key in `<basePath>/<lang>.json`, preserving the
 * file's existing indentation and trailing newline.
 *
 * @throws {@link TranslationFileError} with a 400/404/500 status on failure.
 */
export function updateTranslationFile(
  basePath: string,
  lang: string,
  key: string,
  value: string,
): void {
  if (!LOCALE_PATTERN.test(lang)) {
    throw new TranslationFileError(`Invalid locale "${lang}".`, 400);
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new TranslationFileError('Missing translation key.', 400);
  }

  const segments = key.split('.');
  if (segments.some((segment) => segment.length === 0 || FORBIDDEN_SEGMENTS.has(segment))) {
    throw new TranslationFileError(`Invalid translation key "${key}".`, 400);
  }

  const base = resolve(basePath);
  const filePath = resolve(base, `${lang}.json`);
  if (filePath !== base && !filePath.startsWith(base + sep)) {
    throw new TranslationFileError('Resolved path escapes the translations folder.', 400);
  }
  if (!existsSync(filePath)) {
    throw new TranslationFileError(`Translation file not found: ${lang}.json`, 404);
  }

  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new TranslationFileError(`Cannot read ${lang}.json: ${(error as Error).message}`, 500);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(source) as Record<string, unknown>;
  } catch (error) {
    throw new TranslationFileError(`Invalid JSON in ${lang}.json: ${(error as Error).message}`, 500);
  }

  setDeep(data, segments, value);

  const indent = detectIndent(source);
  const trailingNewline = source.endsWith('\n') ? '\n' : '';
  const output = `${JSON.stringify(data, null, indent)}${trailingNewline}`;

  try {
    writeFileSync(filePath, output, 'utf8');
  } catch (error) {
    throw new TranslationFileError(`Cannot write ${lang}.json: ${(error as Error).message}`, 500);
  }
}
