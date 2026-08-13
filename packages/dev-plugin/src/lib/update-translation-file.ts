import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { applyEdits, modify } from 'jsonc-parser';

/** Error carrying the HTTP status the save middleware should respond with. */
export class TranslationFileError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TranslationFileError';
  }
}

/** Locale codes are restricted to safe filename characters. */
export const LOCALE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function detectIndent(source: string): string {
  const withoutBom = source.startsWith('\uFEFF') ? source.slice(1) : source;
  const lines = withoutBom.split(/\r?\n/);
  for (const line of lines.slice(1)) {
    const match = line.match(/^([ \t]+)\S/);
    if (match) return match[1];
  }
  return '  ';
}

function detectEol(source: string): '\n' | '\r\n' {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

/** Stable scalar revision used by local and cloud optimistic concurrency. */
export function createValueRevision(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function resolveExistingValue(
  target: Record<string, unknown>,
  segments: string[],
): string | undefined {
  let node: unknown = target;
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function isWithinAllowedRoots(
  filePath: string,
  allowedRoots: string[],
): boolean {
  return allowedRoots.some((root) => {
    const base = resolve(root);
    return filePath === base || filePath.startsWith(base + sep);
  });
}

export interface WriteTranslationOptions {
  allowedRoots: string[];
  /** Reject when the current scalar no longer has this revision. */
  expectedRevision?: string;
  /** Existing scalar observed by the editor; used before a revision is known. */
  expectedValue?: string;
}

export interface WriteTranslationResult {
  previousRevision: string;
  revision: string;
}

/**
 * Replace an existing nested JSON scalar with the smallest possible edit.
 * The operation is revision checked, allowlisted, and atomically replaced.
 */
export function writeTranslationAtPath(
  filePath: string,
  lang: string,
  key: string,
  value: string,
  options: WriteTranslationOptions,
): WriteTranslationResult {
  if (!LOCALE_PATTERN.test(lang)) {
    throw new TranslationFileError(`Invalid locale "${lang}".`, 400);
  }
  if (typeof key !== 'string' || key.length === 0) {
    throw new TranslationFileError('Missing translation key.', 400);
  }

  const segments = key.split('.');
  if (
    segments.some(
      (segment) => segment.length === 0 || FORBIDDEN_SEGMENTS.has(segment),
    )
  ) {
    throw new TranslationFileError(`Invalid translation key "${key}".`, 400);
  }

  const resolved = resolve(filePath);
  if (!resolved.endsWith('.json')) {
    throw new TranslationFileError('Resolved path is not a .json file.', 400);
  }
  if (!isWithinAllowedRoots(resolved, options.allowedRoots)) {
    throw new TranslationFileError(
      'Resolved path escapes the allowed roots.',
      400,
    );
  }
  if (!existsSync(resolved)) {
    throw new TranslationFileError(
      `Translation file not found: ${basename(resolved)}`,
      404,
    );
  }

  const name = basename(resolved);
  let source: string;
  try {
    source = readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new TranslationFileError(
      `Cannot read ${name}: ${(error as Error).message}`,
      500,
    );
  }

  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
  const jsonSource = bom ? source.slice(1) : source;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonSource) as Record<string, unknown>;
  } catch (error) {
    throw new TranslationFileError(
      `Invalid JSON in ${name}: ${(error as Error).message}`,
      500,
    );
  }

  const existing = resolveExistingValue(data, segments);
  if (existing === undefined) {
    throw new TranslationFileError(
      `Translation key not found: ${key}. Adding keys is not supported.`,
      404,
    );
  }

  const previousRevision = createValueRevision(existing);
  if (
    options.expectedValue !== undefined &&
    options.expectedValue !== existing
  ) {
    throw new TranslationFileError(
      'Translation changed on disk since the editor was opened.',
      409,
    );
  }
  if (
    options.expectedRevision !== undefined &&
    options.expectedRevision !== previousRevision
  ) {
    throw new TranslationFileError(
      `Translation changed on disk. Expected revision ${options.expectedRevision}, ` +
        `but found ${previousRevision}.`,
      409,
    );
  }

  const indent = detectIndent(source);
  const edits = modify(jsonSource, segments, value, {
    formattingOptions: {
      insertSpaces: indent !== '\t',
      tabSize: indent === '\t' ? 1 : indent.length,
      eol: detectEol(source),
    },
    isArrayInsertion: false,
  });
  const output = bom + applyEdits(jsonSource, edits);
  const temporary = join(dirname(resolved), `.${name}.${randomUUID()}.tmp`);

  try {
    writeFileSync(temporary, output, 'utf8');
    renameSync(temporary, resolved);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw new TranslationFileError(
      `Cannot write ${name}: ${(error as Error).message}`,
      500,
    );
  }

  return { previousRevision, revision: createValueRevision(value) };
}

/** Back-compatible single-folder wrapper. Existing keys only. */
export function updateTranslationFile(
  basePath: string,
  lang: string,
  key: string,
  value: string,
): void {
  const base = resolve(basePath);
  writeTranslationAtPath(resolve(base, `${lang}.json`), lang, key, value, {
    allowedRoots: [base],
  });
}
