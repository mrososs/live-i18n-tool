import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';

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
export const LOCALE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

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

/** True when `filePath` sits within (or equals) one of the `allowedRoots`. */
function isWithinAllowedRoots(filePath: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => {
    const base = resolve(root);
    return filePath === base || filePath.startsWith(base + sep);
  });
}

/** Options for {@link writeTranslationAtPath}. */
export interface WriteTranslationOptions {
  /** Absolute folders the resolved file MUST stay within (traversal guard). */
  allowedRoots: string[];
}

/**
 * Rewrite a single translation key in an already-resolved JSON file, preserving
 * the file's existing indentation and trailing newline.
 *
 * The caller is responsible for choosing which file to write (single folder,
 * feature-split index, or a custom resolver). This function enforces the safety
 * invariants regardless of how the path was chosen: the path must end in
 * `.json`, stay within `allowedRoots`, and the key must not contain empty or
 * prototype-polluting segments.
 *
 * @throws {@link TranslationFileError} with a 400/404/500 status on failure.
 */
export function writeTranslationAtPath(
  filePath: string,
  lang: string,
  key: string,
  value: string,
  options: WriteTranslationOptions,
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

  const resolved = resolve(filePath);
  if (!resolved.endsWith('.json')) {
    throw new TranslationFileError('Resolved path is not a .json file.', 400);
  }
  if (!isWithinAllowedRoots(resolved, options.allowedRoots)) {
    throw new TranslationFileError('Resolved path escapes the allowed roots.', 400);
  }
  if (!existsSync(resolved)) {
    throw new TranslationFileError(`Translation file not found: ${basename(resolved)}`, 404);
  }

  const name = basename(resolved);

  let source: string;
  try {
    source = readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new TranslationFileError(`Cannot read ${name}: ${(error as Error).message}`, 500);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(source) as Record<string, unknown>;
  } catch (error) {
    throw new TranslationFileError(`Invalid JSON in ${name}: ${(error as Error).message}`, 500);
  }

  setDeep(data, segments, value);

  const indent = detectIndent(source);
  const trailingNewline = source.endsWith('\n') ? '\n' : '';
  const output = `${JSON.stringify(data, null, indent)}${trailingNewline}`;

  try {
    writeFileSync(resolved, output, 'utf8');
  } catch (error) {
    throw new TranslationFileError(`Cannot write ${name}: ${(error as Error).message}`, 500);
  }
}

/**
 * Rewrite a single translation key in `<basePath>/<lang>.json`. Back-compat
 * wrapper around {@link writeTranslationAtPath} for the single-folder setup.
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
  const base = resolve(basePath);
  writeTranslationAtPath(resolve(base, `${lang}.json`), lang, key, value, {
    allowedRoots: [base],
  });
}
