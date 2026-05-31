<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

# Project-Specific Guidance

## 1. Project Overview

**Live i18n Editor for Angular** — a zero-config, local-first, in-context translation editor that runs during `ng serve`. Hover any translated text in the browser, click, edit, save → the matching key in your `*.json` translation files is rewritten on disk with formatting preserved.

Two-package design that work together at dev time only:

- **`@live-i18n/client`** ([packages/client-inspector/](packages/client-inspector/)) — standalone Angular component injected into the host app. Renders the hover overlay + floating editor and POSTs `{ key, value, locale }` back to the dev server.
- **`@live-i18n/plugin`** ([packages/dev-plugin/](packages/dev-plugin/)) — Node-side plugin. Parses Angular HTML templates to inject `data-i18n-key` attributes, and hosts a middleware endpoint that safely rewrites translation JSON files.

**Current state (2026-05):** Both packages are at `v0.0.1` with placeholder implementations. The playground app uses Angular's esbuild-based `@angular/build:dev-server` — **not Vite**. The README's "Vite plugin" framing is aspirational; the actual integration surface is still TBD.

## 2. Workspace Layout

```
apps/playground/            # Angular 21 test app (consumes ngx-translate + the inspector lib)
apps/playground-e2e/        # Playwright e2e tests for playground
packages/client-inspector/  # @live-i18n/client — standalone Angular component (ng-packagr build)
packages/dev-plugin/        # @live-i18n/plugin — Node-side plugin (tsc build, placeholder)
.verdaccio/                 # Local npm registry config for dry-run publishing
```

- **Path discrepancy warning:** the README calls these `libs/`. That is **wrong** — the actual folder is `packages/`. Trust the filesystem, not the README.
- TS path alias: `@live-i18n/client` → [packages/client-inspector/src/index.ts](packages/client-inspector/src/index.ts), declared in [tsconfig.base.json](tsconfig.base.json).
- Custom TS condition **`@org/source`** makes in-repo consumers resolve to source files rather than `dist/`. Preserve this `exports` shape when adding new packages — see [packages/dev-plugin/package.json](packages/dev-plugin/package.json) for the pattern.

## 3. Tech Stack (Pinned Versions)

- **Angular 21.2.x** — standalone components, signals, control flow, `@angular/build` (esbuild).
- **Nx 22.7.5** — plugins: `@nx/angular`, `@nx/js`, `@nx/playwright`, `@nx/eslint`.
- **TypeScript 5.9.x** — full strict mode (`strict`, `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).
- **Package manager: npm** — lockfile is `package-lock.json`; workspaces declared in root [package.json](package.json). Do **not** use pnpm or yarn commands.
- **i18n target library:** `@ngx-translate/core` ^17.0.0 + `@ngx-translate/http-loader` ^17.0.0.
- **Unit tests:** Vitest (`vitest-angular` for Angular libs) — **not Jest**.
- **E2E:** Playwright via `@nx/playwright`.
- **Library build:** `ng-packagr` for Angular libs / `@nx/js:tsc` for plain TS libs.

## 4. Common Commands

Always go through Nx with `npx nx` (the workspace uses npm; no global Nx CLI is assumed).

```bash
npx nx serve playground              # dev server, default :4200
npx nx build playground              # production build → dist/apps/playground
npx nx build client-inspector        # ng-packagr build of the Angular lib
npx nx build dev-plugin              # tsc build of the Node plugin
npx nx test playground               # vitest unit tests
npx nx lint <project>                # eslint via @nx/eslint
npx nx typecheck <project>           # tsc --noEmit (auto-discovered by @nx/js/typescript)
npx nx e2e playground-e2e            # playwright tests
npx nx run-many -t build             # build everything
npx nx affected -t test lint         # only affected projects
npx nx local-registry                # start Verdaccio on :4873 for publishing dry-runs
```

## 5. Angular Conventions In This Repo

- **Standalone components only** — no `NgModule`s. Declare deps with `imports: [...]` on the component.
- **Signals for state** — `signal()`, `computed()`, `linkedSignal()`. Avoid `BehaviorSubject` for component state.
- **`inject()` for DI** — do not use constructor parameter injection in new code.
- **`changeDetection: ChangeDetectionStrategy.OnPush`** — set explicitly on every component.
- **New control flow** — `@if` / `@for` / `@switch`. No `*ngIf` / `*ngFor` in new code.
- **`protected` visibility** for template-accessed members — matches existing pattern in [packages/client-inspector/src/lib/client-inspector/client-inspector.ts](packages/client-inspector/src/lib/client-inspector/client-inspector.ts).
- **SCSS** for component styles; `inlineStyleLanguage: "scss"` is configured workspace-wide.
- **Strict TS** — no `any`, no unused locals. Do not silence the compiler with `// @ts-ignore`; fix the type instead.
- When generating Angular code, invoke the `/angular-developer` skill first (workspace hook requirement).

