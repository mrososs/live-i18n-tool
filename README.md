# Live i18n Editor for Angular

> Hover any translated text in your running app, click, edit, save — and the
> matching key in your `*.json` translation file is rewritten on disk, with
> formatting preserved.

A **zero-config, local-first, in-context translation editor** for Angular. It
runs only during `ng serve` and is completely inert in production builds.

No more hunting through nested JSON files to find the key behind a piece of UI
text. You edit translations where you see them — in the browser, in context.

## Demo

A ~60-second tour: arm the inspector, hover a translated string, rewrite it, and
watch the matching key land in `<lang>.json` on disk. Want it in context? The
[**live landing page**](https://mrososs.github.io/live-i18n-tool/) runs the
editor on itself.

<video src="https://github.com/mrososs/live-i18n-tool/raw/main/apps/landing/src/assets/video/live-i18n.mp4" controls playsinline width="100%"></video>

> Not playing inline? [**Watch / download the demo video**](apps/landing/src/assets/video/live-i18n.mp4).

## How it works

Two packages cooperate at dev time:

| Package | Side | Role |
| ------- | ---- | ---- |
| [`@live-i18n/client`](packages/client-inspector/) | Browser | Standalone Angular library. Auto-tags translated elements, renders the hover overlay + floating editor, and POSTs edits to the dev server. |
| [`@live-i18n/plugin`](packages/dev-plugin/) | Node | Custom Angular dev-server builder that mounts a save-API middleware and safely rewrites translation JSON on disk. |

```
Browser (ng serve)                          Dev server (custom builder)
──────────────────                          ───────────────────────────
 AutoTagService tags elements
   with data-i18n-key
         │
   hover  → overlay highlights
   click  → editor opens
   edit   → save
         │
         └── POST { key, value, lang } ─────▶ save middleware
                                                validates + guards input
                                                routes to the right file
                                                rewrites <lang>.json on disk
                                                (indentation + newline kept)
         ◀────────── 200 { ok } ─────────────────┘
```

### Browser side — `@live-i18n/client`

On startup (dev only) it mounts an **overlay**, an **editor**, and a **toggle**
onto `document.body`, then begins tagging translated elements with
`data-i18n-key` — **no template annotations required**. It resolves the key for
each element two ways:

- **Invisible key markers** (primary) — emitted by the translate pipe so the
  inspector recovers the *exact* key, even when two different keys render
  identical text.
- **Reverse-lookup** (fallback) — matches rendered text back to the loaded
  dictionary, including interpolated values like `Hello, {{name}}!` via a
  compiled wildcard regex.

A `MutationObserver` re-scans as the DOM and active language change.

### Node side — `@live-i18n/plugin`

A custom builder (`@live-i18n/plugin:dev-server`) wraps Angular's
`executeDevServerBuilder` and mounts a middleware on
`POST /__live-i18n-update`. It:

- Routes each edit to the **correct file**, scanning multiple `searchRoots` to
  support **feature-split** translation folders, with a `defaultPath` fallback
  for brand-new keys.
- Rewrites `<resolved-path>/<lang>.json`, preserving indentation and trailing
  newline.
- **Guards every write:** the locale must match `^[a-zA-Z][a-zA-Z0-9_-]*$`, the
  resolved path must stay inside the allowed roots (no traversal), and
  `__proto__` / `prototype` / `constructor` key segments are rejected
  (prototype-pollution defense).

> **Why a builder and not a Vite plugin?** Angular's dev server runs Vite
> in-memory — there is no `vite.config.*` to register a plugin in, and AOT
> component templates never pass through Vite's `.html` transform. The supported
> seam is the public `executeDevServerBuilder(options, context, extensions)`
> API, which this package wraps to inject the save middleware.

## Compatibility

`@live-i18n/plugin` is a standard **Angular CLI builder** (built on
`@angular-devkit/architect`), not an Nx-only executor — Nx executors and Angular
builders are the same underlying mechanism. It works with **any modern Angular
project**, whether you use an Nx workspace or a plain Angular CLI app.

The only real requirement is the **esbuild/Vite-based application builder**
(`@angular/build`, the default for Angular **17+** apps). The plugin wraps that
dev server's `executeDevServerBuilder`; it does **not** support the legacy
Webpack builder (`@angular-devkit/build-angular:browser`/`:dev-server`).

`@live-i18n/client` is a plain standalone Angular library and works in any
Angular app.

## Usage

**1. Point your app's `serve` target at the builder.** In an **Nx workspace**,
edit `project.json` — register it as an `executor`:

```jsonc
// project.json (Nx)
"serve": {
  "executor": "@live-i18n/plugin:dev-server",
  "continuous": true,
  "dependsOn": ["^build", { "projects": ["dev-plugin"], "target": "build" }],
  "options": {
    "translationsPath": "apps/playground/src/assets/i18n",
    // Optional: extra roots to scan for feature-split <lang>.json files.
    "searchRoots": [
      "apps/playground/src/assets/i18n",
      "apps/playground/src/app/features"
    ]
  },
  "configurations": {
    "development": { "buildTarget": "playground:build:development" },
    "production": { "buildTarget": "playground:build:production" }
  },
  "defaultConfiguration": "development"
}
```

In a **plain Angular CLI workspace**, edit `angular.json` instead — the field is
`builder` (not `executor`), and there's no `continuous`/`dependsOn` (those are
Nx task-graph concepts):

```jsonc
// angular.json (Angular CLI)
"serve": {
  "builder": "@live-i18n/plugin:dev-server",
  "options": {
    "buildTarget": "my-app:build",
    "translationsPath": "src/assets/i18n",
    // Optional: extra roots to scan for feature-split <lang>.json files.
    "searchRoots": ["src/assets/i18n", "src/app/features"]
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" },
    "production": { "buildTarget": "my-app:build:production" }
  },
  "defaultConfiguration": "development"
}
```

**2. Enable the inspector in your app providers** (`app.config.ts`):

```ts
import { isDevMode } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { enableKeyMarkers, provideLiveTranslations } from '@live-i18n/client';

// Emit invisible key markers from the translate pipe (dev-only, no-op in prod).
enableKeyMarkers(TranslatePipe, isDevMode());

export const appConfig: ApplicationConfig = {
  providers: [
    // ...provideTranslateService(...), etc.
    provideLiveTranslations(() => {
      const translate = inject(TranslateService);
      let translations: Record<string, unknown> = {};
      translate.onLangChange.subscribe((e) => {
        translations = e.translations as Record<string, unknown>;
      });
      return {
        getLocale: () => translate.getCurrentLang(),
        getTranslations: () => translations,
      };
    }),
  ],
};
```

**3. Serve as usual** — the inspector activates and the save API listens:

```bash
npx nx serve playground   # Nx workspace
ng serve                  # plain Angular CLI
```

See [`packages/dev-plugin/README.md`](packages/dev-plugin/README.md) for the
full builder options, the save-endpoint contract, and the programmatic API.

## Workspace layout

```
apps/playground/            # Angular 21 demo app (ngx-translate + the inspector)
apps/playground-e2e/        # Playwright e2e tests for the playground
packages/client-inspector/  # @live-i18n/client — standalone Angular library
packages/dev-plugin/        # @live-i18n/plugin — Node dev-server builder
.verdaccio/                 # Local npm registry for publishing dry-runs
```

This is an [Nx](https://nx.dev) monorepo (npm, **not** pnpm/yarn), Angular 21,
TypeScript 5.9 (full strict). Unit tests run on Vitest; e2e on Playwright.

## Common commands

```bash
npx nx serve playground         # dev server with the live editor, :4200
npx nx build client-inspector   # ng-packagr build of the Angular library
npx nx build dev-plugin         # tsc build of the Node builder
npx nx test playground          # vitest unit tests
npx nx e2e playground-e2e       # playwright e2e tests
npx nx run-many -t build        # build everything
npx nx affected -t test lint    # only affected projects
```

## Status

Early development (`v0.0.1`). The two packages have working implementations and
are exercised end-to-end by the playground app, including duplicate-text
disambiguation and feature-split translation files. APIs may still change.
