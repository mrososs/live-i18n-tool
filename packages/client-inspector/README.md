# @live-i18n/client

> Hover any translated text in your running Angular app, click, edit, save — and
> the matching key in your `*.json` translation file is rewritten on disk, with
> formatting preserved.

The **browser half** of the [Live i18n Editor for Angular][repo] — a
zero-config, local-first, in-context translation editor. It runs only during
`ng serve` and is completely inert in production builds.

It pairs with [`@live-i18n/plugin`][plugin], the Node-side dev-server builder
that receives edits and rewrites your translation JSON.

## Install

```bash
npm install --save-dev @live-i18n/client @live-i18n/plugin
```

Peer dependencies: `@angular/core` and `@angular/common` (`^21.2.0`). Designed
to sit alongside [`@ngx-translate/core`][ngx-translate], but the API is
loader-agnostic — you supply getters for the current locale and dictionary.

## Setup

Wire it into your app config. It mounts the overlay, editor, and toggle on
startup and tags translated elements automatically — **no template annotations
required**.

```ts
import { ApplicationConfig } from '@angular/core';
import { provideLiveTranslations } from '@live-i18n/client';
import { TranslateService } from '@ngx-translate/core';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...your existing providers (provideTranslateService, etc.)
    provideLiveTranslations({
      // Current language code, e.g. 'en' / 'ar'.
      getLang: (translate = inject(TranslateService)) => translate.currentLang,
      // Flat or nested dictionary for the current language.
      getDictionary: (translate = inject(TranslateService)) =>
        translate.store.translations[translate.currentLang],
    }),
  ],
};
```

> The editor only activates in development. Guard the call with your own
> environment check if you want to be explicit (e.g. `if (!environment.production)`).

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
  provideLiveTranslations,   // the main entry point
  LIVE_TRANSLATIONS_CONFIG,  // DI token for the resolved config
  DEFAULT_SAVE_ENDPOINT,     // '/__live-i18n-update'
  enableKeyMarkers,          // opt into invisible key markers on a translate pipe
  SaveClient,                // posts edits to the dev server
  AutoTagService,            // runtime data-i18n-key tagger
  InspectorStateService,
  InspectorTrackingService,
  I18nKeyDirective,
  InspectorOverlay,
  InspectorEditor,
  InspectorToggle,
} from '@live-i18n/client';
```

See [`provideLiveTranslations`][repo] for the full option list
(`LiveTranslationsOptions`: `getLang`, `getDictionary`, `endpoint`, …).

## Production safety

This package is intended as a `devDependency`. Nothing it does has an effect in
a production build — the overlay never mounts and no network calls are made
outside the dev server.

## License

MIT © Mohamed Osama. See [LICENSE](./LICENSE).

[repo]: https://github.com/mrososs/live-i18n-tool
[plugin]: https://www.npmjs.com/package/@live-i18n/plugin
[ngx-translate]: https://www.npmjs.com/package/@ngx-translate/core
