# @live-i18n/plugin

Node-side dev-time backend for the **Live i18n Editor**. It ships a custom
Angular dev-server builder that wraps `@angular/build:dev-server` and mounts a
small save API. When the in-browser inspector (`@live-i18n/client`) posts an
edit, the matching key in your translation JSON is rewritten on disk —
indentation and trailing newline preserved.

> **Why a builder, not a Vite plugin?** Angular's dev server runs Vite
> in-memory; there is no `vite.config.*` to register a plugin in, and AOT
> component templates never pass through Vite's `.html` transform. The supported
> seam is the public `executeDevServerBuilder(options, context, extensions)`,
> which this package wraps to inject the save middleware.

## Setup

**1. Build this package** (the builder is consumed as compiled JS):

```bash
npx nx build dev-plugin
```

**2. Point your app's `serve` target at the builder** (in `project.json`):

```jsonc
"serve": {
  "executor": "@live-i18n/plugin:dev-server",
  "continuous": true,
  // Build the builder before serving.
  "dependsOn": ["^build", { "projects": ["dev-plugin"], "target": "build" }],
  "options": {
    // Workspace-relative folder holding your <lang>.json files.
    "translationsPath": "apps/playground/src/assets/i18n"
    // "endpoint": "/__live-i18n-update"  // optional override
  },
  "configurations": {
    "development": { "buildTarget": "playground:build:development" },
    "production": { "buildTarget": "playground:build:production" }
  },
  "defaultConfiguration": "development"
}
```

`npx nx serve playground` now serves as usual and additionally listens for
`POST /__live-i18n-update`.

## How it pairs with `@live-i18n/client`

The client auto-tags translated elements with `data-i18n-key` (reverse-looking
up rendered text against the loaded dictionary — no manual directive needed) and
posts `{ key, value, lang }` to the endpoint. This builder validates the request
and rewrites `<translationsPath>/<lang>.json`. See `@live-i18n/client`'s
`provideLiveTranslations(...)` for wiring the locale/dictionary getters.

## Save endpoint

`POST <endpoint>` — body `{ key: string, value: string, lang: string }`

| Status | Meaning |
| ------ | --------------------------------------------------------- |
| 200    | `{ ok: true, key, lang }` — file updated                  |
| 400    | invalid JSON / missing fields / unsafe locale or key      |
| 404    | `<lang>.json` not found in `translationsPath`             |
| 500    | read / parse / write failure                              |

Guards: the locale must match `^[a-zA-Z][a-zA-Z0-9_-]*$`, the resolved path must
stay inside `translationsPath`, and key segments `__proto__` / `prototype` /
`constructor` are rejected (prototype-pollution).

## Programmatic API

```ts
import { updateTranslationFile, createSaveMiddleware } from '@live-i18n/plugin';
```

- `updateTranslationFile(basePath, lang, key, value)` — the safe JSON writer.
- `createSaveMiddleware({ translationsPath, endpoint })` — the Connect
  middleware, if you want to mount it yourself.

## Building / testing

```bash
npx nx build dev-plugin
```
