import { resolve } from 'node:path';
import { createBuilder, type BuilderContext, type BuilderOutput } from '@angular-devkit/architect';
import { executeDevServerBuilder, type DevServerBuilderOptions } from '@angular/build';
import { createSaveMiddleware } from '../save-middleware.js';

/** Options accepted by the `@live-i18n/plugin:dev-server` builder. */
export interface LiveI18nDevServerOptions extends DevServerBuilderOptions {
  /** Workspace-relative path to the folder holding locale JSON files. */
  translationsPath: string;
  /** Route that accepts translation save requests. */
  endpoint?: string;
}

const DEFAULT_ENDPOINT = '/__live-i18n-update';

/**
 * Runs the standard Angular dev server, additionally mounting the live-i18n
 * save API as a middleware so in-context edits persist to disk.
 */
export async function* executeLiveI18nDevServer(
  options: LiveI18nDevServerOptions,
  context: BuilderContext,
): AsyncIterable<BuilderOutput> {
  const { translationsPath, endpoint = DEFAULT_ENDPOINT, ...devServerOptions } = options;
  const absoluteTranslationsPath = resolve(context.workspaceRoot, translationsPath);

  context.logger.info(
    `[live-i18n] save API listening on POST ${endpoint} → ${absoluteTranslationsPath}`,
  );

  const middleware = createSaveMiddleware({
    translationsPath: absoluteTranslationsPath,
    endpoint,
  });

  yield* executeDevServerBuilder(devServerOptions, context, {
    middleware: [middleware],
  });
}

export default createBuilder<LiveI18nDevServerOptions>(executeLiveI18nDevServer);
