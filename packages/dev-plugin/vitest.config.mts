import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  // The source uses NodeNext ESM specifiers (`./foo.js`) that point at `.ts`
  // files. Map those back to the TypeScript source so Vitest can load them.
  plugins: [
    {
      name: 'live-i18n-js-to-ts',
      enforce: 'pre',
      resolveId(source: string, importer: string | undefined) {
        if (importer && source.startsWith('.') && source.endsWith('.js')) {
          const candidate = resolve(dirname(importer), `${source.slice(0, -3)}.ts`);
          if (existsSync(candidate)) {
            return candidate;
          }
        }
        return null;
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
