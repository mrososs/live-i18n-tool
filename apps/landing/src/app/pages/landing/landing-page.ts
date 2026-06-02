import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BrowserDemo } from '../../components/browser-demo/browser-demo';
import { CodeBlock } from '../../components/code-block/code-block';
import { Logo } from '../../components/logo/logo';

interface Step {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

interface Feature {
  readonly title: string;
  readonly body: string;
}

@Component({
  selector: 'app-landing-page',
  imports: [Logo, CodeBlock, BrowserDemo, TranslatePipe],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  protected readonly year = 2026;

  /** Mobile navigation drawer open state (burger menu, < md only). */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected readonly flow: readonly Step[] = [
    {
      n: '01',
      title: 'Tag',
      body: 'On dev startup the client walks the DOM and stamps data-i18n-key onto every translated node — no template annotations from you.',
    },
    {
      n: '02',
      title: 'Hover',
      body: 'Move over any rendered string. The overlay outlines it and surfaces the exact translation key behind it.',
    },
    {
      n: '03',
      title: 'Edit',
      body: 'Click to open the floating editor and rewrite the text in place, in the language you are viewing.',
    },
    {
      n: '04',
      title: 'Save',
      body: 'A POST of { key, value, lang } hits the dev server and the matching <lang>.json is rewritten on disk.',
    },
  ];

  protected readonly features: readonly Feature[] = [
    {
      title: 'Exact key resolution',
      body: 'Invisible key markers from the translate pipe recover the precise key — even when two keys render identical text. A reverse-lookup fallback matches rendered text back to the dictionary, interpolation and all.',
    },
    {
      title: 'Safe disk writes',
      body: 'Every write is guarded: the locale must match a strict pattern, the resolved path cannot escape its roots, and __proto__ / prototype / constructor segments are rejected. Indentation and trailing newline are preserved.',
    },
    {
      title: 'Feature-split aware',
      body: 'Edits route across multiple searchRoots, so feature-folder <lang>.json files just work — with a defaultPath fallback for brand-new keys.',
    },
    {
      title: 'Inert in production',
      body: 'It runs only during ng serve. Production builds ship nothing: no overlay, no markers, no middleware, no bytes.',
    },
  ];

  protected readonly cmdInstall =
    'npm i -D @live-i18n/client @live-i18n/plugin';

  protected readonly cmdServe = 'npx nx serve my-app   # or: ng serve';

  /** Which serve-target recipe is shown in step 2. */
  protected readonly serveTool = signal<'nx' | 'cli'>('nx');

  protected setServeTool(tool: 'nx' | 'cli'): void {
    this.serveTool.set(tool);
  }

  protected readonly codePluginNx = `"serve": {
  "executor": "@live-i18n/plugin:dev-server",
  "continuous": true,
  "options": {
    "translationsPath": "apps/my-app/src/assets/i18n",
    "searchRoots": [
      "apps/my-app/src/assets/i18n",
      "apps/my-app/src/app/features"
    ]
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}`;

  protected readonly codePluginCli = `"serve": {
  "builder": "@live-i18n/plugin:dev-server",
  "options": {
    "buildTarget": "my-app:build",
    "translationsPath": "src/assets/i18n",
    "searchRoots": ["src/assets/i18n", "src/app/features"]
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}`;

  /** Which i18n-library recipe is shown in step 3. */
  protected readonly clientLib = signal<'ngx' | 'transloco'>('ngx');

  protected setClientLib(lib: 'ngx' | 'transloco'): void {
    this.clientLib.set(lib);
  }

  protected readonly codeClientNgx = `import { inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { provideLiveTranslations, withNgxTranslate } from '@live-i18n/client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...provideTranslateService(...) etc.
    provideLiveTranslations(() =>
      withNgxTranslate(inject(TranslateService), TranslatePipe),
    ),
  ],
};`;

  protected readonly codeClientTransloco = `import { inject } from '@angular/core';
import {
  TranslocoService,
  TranslocoPipe,
  TranslocoDirective,
} from '@jsverse/transloco';
import { provideLiveTranslations, withTransloco } from '@live-i18n/client';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...provideTransloco(...) etc.
    provideLiveTranslations(() =>
      withTransloco(inject(TranslocoService), TranslocoPipe, TranslocoDirective),
    ),
  ],
};`;
}
