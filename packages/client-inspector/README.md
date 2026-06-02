# @live-i18n/client

> Hover any translated text in your running Angular app, click, edit, save — and
> the matching key in your `*.json` translation file is rewritten on disk, with
> formatting preserved.

The **browser half** of the [Live i18n Editor for Angular][repo] — a
zero-config, local-first, in-context translation editor. It runs only during
`ng serve` and is completely inert in production builds.

It pairs with [`@live-i18n/plugin`][plugin], the Node-side dev-server builder
that receives edits and rewrites your translation JSON.

## Requirements

- **Angular 17+** using the esbuild/Vite **application builder** (`@angular/build`,
  the default for new apps). The legacy Webpack builder
  (`@angular-devkit/build-angular:browser`) is **not** supported.
- An i18n library that loads translations from `*.json` files. Adapters ship for
  [`@ngx-translate/core`][ngx-translate] and [Transloco][transloco]; any other
  library works with a small custom adapter.
- Works in both **Nx** workspaces and **plain Angular CLI** apps.

## Install

Install both packages as **dev dependencies** — neither reaches your production
bundle:

```bash
npm install --save-dev @live-i18n/client @live-i18n/plugin
```

Peer dependencies: `@angular/core` and `@angular/common` (`^21.2.0`).

## Setup

Three steps: point the dev-server at the save-API builder, register the
inspector provider, then serve.

### 1. Point your dev-server at the builder

`@live-i18n/plugin` is a standard Angular CLI builder that wraps the normal
dev-server and adds the `POST /__live-i18n-update` save API. Without it, edits
have nowhere to be written. Swap your `serve` target to it.

**Nx** — edit the app's `project.json` (the field is `executor`):

```jsonc
"serve": {
  "executor": "@live-i18n/plugin:dev-server",
  "continuous": true,
  "options": {
    // Folder holding your <lang>.json files (workspace-relative).
    "translationsPath": "apps/my-app/src/assets/i18n",
    // Optional: extra roots to scan for feature-split <lang>.json files.
    "searchRoots": [
      "apps/my-app/src/assets/i18n",
      "apps/my-app/src/app/features"
    ]
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" },
    "production": { "buildTarget": "my-app:build:production" }
  },
  "defaultConfiguration": "development"
}
```

**Plain Angular CLI** — edit `angular.json` (the field is `builder`; there is no
`continuous`/`dependsOn`):

```jsonc
"serve": {
  "builder": "@live-i18n/plugin:dev-server",
  "options": {
    "buildTarget": "my-app:build",
    "translationsPath": "src/assets/i18n",
    "searchRoots": ["src/assets/i18n", "src/app/features"]
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" },
    "production": { "buildTarget": "my-app:build:production" }
  },
  "defaultConfiguration": "development"
}
```

See [`@live-i18n/plugin`][plugin] for the full builder options and the
save-endpoint contract.

### 2. Register the inspector provider

Add `provideLiveTranslations(...)` to your app config with the adapter for your
i18n library. It mounts the overlay, editor, and toggle on startup, tags
translated elements automatically, and emits the invisible key markers for
you — **no template annotations required**.

**ngx-translate:**

```ts
import { ApplicationConfig, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { provideLiveTranslations, withNgxTranslate } from '@live-i18n/client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...your existing providers (provideTranslateService, etc.)
    provideLiveTranslations(() =>
      withNgxTranslate(inject(TranslateService), TranslatePipe),
    ),
  ],
};
```

**Transloco:**

```ts
import { ApplicationConfig, inject } from '@angular/core';
import { TranslocoService, TranslocoPipe, TranslocoDirective } from '@jsverse/transloco';
import { provideLiveTranslations, withTransloco } from '@live-i18n/client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...your existing providers (provideTransloco, etc.)
    provideLiveTranslations(() =>
      // 3rd arg is optional: pass TranslocoDirective to also tag
      // `*transloco` / `[transloco]="'key'"` elements.
      withTransloco(inject(TranslocoService), TranslocoPipe, TranslocoDirective),
    ),
  ],
};
```

**Another i18n library?** Skip the adapter and pass options directly. An adapter
is just a function that returns this options object, so supporting a new library
is a few lines:

```ts
provideLiveTranslations(() => {
  const t = inject(MyI18nService);
  return {
    getLocale: () => t.currentLang,
    getTranslations: () => t.dictionaryFor(t.currentLang),
    patchPipe: MyTranslatePipe, // optional: enables exact-key markers
  };
});
```

> The editor only activates in development (`isDevMode()`); the initializer
> early-returns in production builds, so there is nothing to guard manually.

### 3. Serve and edit

```bash
npx nx serve my-app   # Nx workspace
ng serve              # plain Angular CLI
```

Open the app, click the floating toggle to arm the inspector, hover any
translated string, edit it, and save. The matching key in `<lang>.json` is
rewritten on disk — indentation and trailing newline preserved.

## How it resolves the key behind a piece of text

For each translated element it recovers the originating key two ways:

- **Invisible key markers** (primary) — emitted by the translate pipe so the
  inspector recovers the _exact_ key, even when two different keys render
  identical text.
- **Reverse-lookup** (fallback) — matches the rendered text back against the
  loaded dictionary.

Tagged elements get a `data-i18n-key` attribute at runtime. Hover highlights
them; clicking opens the floating editor; saving POSTs `{ key, value, lang }` to
the dev server, where [`@live-i18n/plugin`][plugin] writes it to disk.

## Public API

```ts
import {
  provideLiveTranslations,        // the main entry point
  withNgxTranslate,               // adapter for @ngx-translate/core
  withTransloco,                  // adapter for Transloco (pipe + directive)
  LIVE_TRANSLATIONS_CONFIG,       // DI token for the resolved config
  DEFAULT_SAVE_ENDPOINT,          // '/__live-i18n-update'
  enableKeyMarkers,               // low-level: key markers on a translate pipe
  enableKeyMarkersOnDirective,    // low-level: key markers on a directive
  SaveClient,                     // posts edits to the dev server
  AutoTagService,                 // runtime data-i18n-key tagger
  InspectorStateService,
  InspectorTrackingService,
  I18nKeyDirective,
  InspectorOverlay,
  InspectorEditor,
  InspectorToggle,
} from '@live-i18n/client';
```

See [`provideLiveTranslations`][repo] for the full option list
(`LiveTranslationsOptions`: `getLocale`, `getTranslations`, `endpoint`,
`patchPipe`, `patchDirectives`).

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Toggle/overlay never appears | The app is a production build (`isDevMode()` is `false`), or `provideLiveTranslations(...)` isn't in your providers. |
| Hover highlights nothing | The adapter's `getTranslations()` returns an empty dictionary — make sure a language is loaded before you hover, and that you passed the correct `TranslateService`/`TranslocoService`. |
| Edits don't save (network error / 404) | The `serve` target isn't pointed at `@live-i18n/plugin:dev-server`, or `translationsPath` doesn't contain the `<lang>.json` you're editing. See step 1. |
| Two identical strings resolve to the same wrong key | Key markers aren't enabled. Use an adapter (it wires `patchPipe` for you) or set `patchPipe` manually so the inspector recovers the exact key. |
| `[transloco]` / `*transloco` elements aren't tagged | Pass `TranslocoDirective` as the 3rd argument to `withTransloco(...)`. |

## Production safety

This package is intended as a `devDependency`. Nothing it does has an effect in
a production build — the overlay never mounts and no network calls are made
outside the dev server.

## License

MIT © Mohamed Osama. See [LICENSE](./LICENSE).

[repo]: https://github.com/mrososs/live-i18n-tool
[plugin]: https://www.npmjs.com/package/@live-i18n/plugin
[ngx-translate]: https://www.npmjs.com/package/@ngx-translate/core
[transloco]: https://jsverse.github.io/transloco/
