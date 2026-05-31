import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { flattenTranslations } from './flatten-translations.js';

/**
 * Recognises a locale-style filename stem (BCP-47-ish): a 2–3 letter primary
 * subtag, optionally followed by `-`/`_` subtags (`en`, `ar`, `en-US`, `pt-BR`,
 * `zh-Hans`). Intentionally stricter than the writer's `LOCALE_PATTERN` so a
 * broad scan never mistakes `package.json`, `tsconfig.json`, or `messages.json`
 * for a locale file.
 */
const LOCALE_FILENAME_PATTERN = /^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/i;

/** Minimal logger surface — satisfied by Angular's `context.logger`. */
export interface IndexerLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** Inputs for {@link TranslationIndexer.build}. */
export interface BuildIndexOptions {
  /** Absolute workspace root (for tidy relative paths in log messages). */
  workspaceRoot: string;
  /** Absolute folders to scan recursively for `<lang>.json` files. */
  searchRoots: string[];
  logger: IndexerLogger;
}

/** Path segments we never descend into while scanning. */
const IGNORED_DIRS = new Set(['node_modules', 'dist']);

/**
 * Server-side map of `${lang}:${flatKey}` → the absolute JSON file that owns it.
 *
 * The client only ever sends a flat key + locale; it has no idea which physical
 * file a key lives in (ngx-translate merges every loaded dictionary before the
 * inspector sees it). So the dev server scans the configured roots once at
 * startup, flattens every locale file, and records where each key came from —
 * letting the save API route an edit to the correct feature file.
 */
export class TranslationIndexer {
  /** `${lang}:${flatKey}` → absolute file path. */
  private readonly map = new Map<string, string>();

  /**
   * Scan `searchRoots` for `<lang>.json` files and index their flattened keys.
   * Never throws: unreadable roots and unparseable files are warned and skipped.
   */
  static build(options: BuildIndexOptions): TranslationIndexer {
    const { workspaceRoot, searchRoots, logger } = options;
    const indexer = new TranslationIndexer();

    const files = collectLocaleFiles(searchRoots, logger);
    let locales = 0;
    const seenLocales = new Set<string>();

    for (const { path, lang } of files) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      } catch (error) {
        logger.warn(
          `[live-i18n] skipped ${relative(workspaceRoot, path)} — ${(error as Error).message}`,
        );
        continue;
      }

      if (!seenLocales.has(lang)) {
        seenLocales.add(lang);
        locales++;
      }

      for (const [flatKey] of flattenTranslations(parsed)) {
        const mapKey = `${lang}:${flatKey}`;
        const existing = indexer.map.get(mapKey);
        if (existing !== undefined) {
          // First-found wins (deterministic via sorted scan); warn so the dev
          // can de-duplicate. Mirrors the client's own "first key wins" rule.
          logger.warn(
            `[live-i18n] duplicate key "${flatKey}" (${lang}) in ` +
              `${relative(workspaceRoot, path)}; keeping ${relative(workspaceRoot, existing)}`,
          );
          continue;
        }
        indexer.map.set(mapKey, path);
      }
    }

    logger.info(
      `[live-i18n] indexed ${indexer.map.size} keys from ${files.length} file(s) ` +
        `across ${locales} locale(s)`,
    );
    return indexer;
  }

  /** Absolute file path owning `key` for `lang`, or `undefined` if unknown. */
  resolve(lang: string, key: string): string | undefined {
    return this.map.get(`${lang}:${key}`);
  }

  /** Remember that `key` (for `lang`) now lives in `filePath` (after a write). */
  record(lang: string, key: string, filePath: string): void {
    this.map.set(`${lang}:${key}`, resolve(filePath));
  }

  /** Number of indexed `lang:key` entries. */
  get size(): number {
    return this.map.size;
  }
}

/** A discovered locale file and the locale derived from its filename. */
interface LocaleFile {
  path: string;
  lang: string;
}

/**
 * Recursively collect `<lang>.json` files under each root, where `<lang>` is a
 * valid locale stem (so `tsconfig.json`/`package.json` are never matched).
 * Returns results sorted by (root order, path) for deterministic indexing.
 */
function collectLocaleFiles(
  searchRoots: string[],
  logger: IndexerLogger,
): LocaleFile[] {
  const files: LocaleFile[] = [];

  for (const root of searchRoots) {
    const base = resolve(root);
    let entries: { parentPath: string; name: string; isFile(): boolean }[];
    try {
      entries = readdirSync(base, {
        recursive: true,
        withFileTypes: true,
      }) as unknown as {
        parentPath: string;
        name: string;
        isFile(): boolean;
      }[];
    } catch {
      logger.warn(`[live-i18n] search root not found, skipping: ${root}`);
      continue;
    }

    const found: LocaleFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const full = join(entry.parentPath, entry.name);
      const rel = relative(base, full);
      if (rel.split(sep).some((segment) => IGNORED_DIRS.has(segment))) {
        continue;
      }
      const stem = basename(entry.name, '.json');
      if (!LOCALE_FILENAME_PATTERN.test(stem)) {
        continue;
      }
      found.push({ path: full, lang: stem });
    }

    found.sort((a, b) => a.path.localeCompare(b.path));
    files.push(...found);
  }

  return files;
}
