import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBuilder, type BuilderContext, type BuilderOutput } from '@angular-devkit/architect';
import { executeDevServerBuilder, type DevServerBuilderOptions } from '@angular/build';
import {
  createSaveMiddleware,
  type ResolveFilePath,
} from '../save-middleware.js';
import { TranslationIndexer } from '../translation-indexer.js';

/** Options accepted by the `@live-i18n/plugin:dev-server` builder. */
export interface LiveI18nDevServerOptions extends DevServerBuilderOptions {
  /**
   * Workspace-relative folder holding the primary locale JSON files. Used as
   * the default destination for brand-new keys and as a search root.
   */
  translationsPath: string;
  /** Route that accepts translation save requests. */
  endpoint?: string;
  /**
   * Workspace-relative folders scanned (recursively) for `<lang>.json` files.
   * Defaults to `[translationsPath]`. Use this to pick up feature-split i18n.
   */
  searchRoots?: string[];
  /**
   * Workspace-relative fallback folder for keys not found in any scanned file.
   * Defaults to `translationsPath`.
   */
  defaultPath?: string;
  /**
   * Workspace-relative `.mjs`/`.js` module whose default export may provide
   * `{ resolveFilePath?, searchRoots?, defaultPath? }`. The only way to supply
   * a `resolveFilePath` function (project.json cannot hold functions).
   */
  configFile?: string;
}

/** Shape of a `configFile`'s default export. */
interface LiveI18nConfig {
  resolveFilePath?: ResolveFilePath;
  searchRoots?: string[];
  defaultPath?: string;
}

const DEFAULT_ENDPOINT = '/__live-i18n-update';

/**
 * Runs the standard Angular dev server, additionally mounting the live-i18n
 * save API as a middleware so in-context edits persist to disk — routing each
 * edit to the correct file across feature-split translation folders.
 */
export async function* executeLiveI18nDevServer(
  options: LiveI18nDevServerOptions,
  context: BuilderContext,
): AsyncIterable<BuilderOutput> {
  const {
    translationsPath,
    endpoint = DEFAULT_ENDPOINT,
    searchRoots,
    defaultPath,
    configFile,
    ...devServerOptions
  } = options;

  const config = await loadConfigFile(configFile, context);

  const toAbs = (p: string): string => resolve(context.workspaceRoot, p);

  const defaultPathAbs = toAbs(config.defaultPath ?? defaultPath ?? translationsPath);
  const searchRootsAbs = unique(
    [
      ...(config.searchRoots ?? searchRoots ?? []),
      translationsPath,
      config.defaultPath ?? defaultPath ?? translationsPath,
    ].map(toAbs),
  );
  // Every resolved write must land inside a scanned root (or the default).
  const allowedRoots = unique([...searchRootsAbs, defaultPathAbs]);

  const indexer = TranslationIndexer.build({
    workspaceRoot: context.workspaceRoot,
    searchRoots: searchRootsAbs,
    logger: context.logger,
  });

  context.logger.info(
    `[live-i18n] save API listening on POST ${endpoint} ` +
      `(default → ${defaultPathAbs})`,
  );

  const middleware = createSaveMiddleware({
    endpoint,
    indexer,
    defaultPath: defaultPathAbs,
    allowedRoots,
    resolveFilePath: config.resolveFilePath,
    logger: context.logger,
  });

  yield* executeDevServerBuilder(devServerOptions, context, {
    middleware: [middleware],
  });
}

/**
 * Dynamically import the optional config module. Any failure (missing file,
 * import/parse error) is warned and treated as an empty config so the dev
 * server always starts.
 */
async function loadConfigFile(
  configFile: string | undefined,
  context: BuilderContext,
): Promise<LiveI18nConfig> {
  if (!configFile) {
    return {};
  }
  const absolute = resolve(context.workspaceRoot, configFile);
  try {
    const module = (await import(pathToFileURL(absolute).href)) as {
      default?: LiveI18nConfig;
    } & LiveI18nConfig;
    const config = module.default ?? module;
    context.logger.info(`[live-i18n] loaded config from ${configFile}`);
    return config;
  } catch (error) {
    context.logger.warn(
      `[live-i18n] could not load configFile "${configFile}"; ` +
        `continuing without it. ${(error as Error).message}`,
    );
    return {};
  }
}

/** De-duplicate while preserving first-seen order. */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export default createBuilder<LiveI18nDevServerOptions>(executeLiveI18nDevServer);
