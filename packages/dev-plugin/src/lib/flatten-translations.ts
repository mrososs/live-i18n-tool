/**
 * Flatten a nested translation dictionary into dotted keys.
 *
 * Mirrors the client-side flattening in
 * `@live-i18n/client` (`auto-tag.service.ts`) so the dev-server and the browser
 * agree on the exact key string for every value. It cannot import that code
 * directly — the client version is an Angular service — so the pure algorithm
 * is duplicated here.
 *
 * `{ AUTH: { LOGIN: "Log in" } }` becomes `Map { "AUTH.LOGIN" => "Log in" }`.
 * Only string leaves are collected; arrays and non-string values are ignored,
 * matching what the inspector can actually edit.
 */
export function flattenTranslations(
  node: Record<string, unknown>,
): Map<string, string> {
  const out = new Map<string, string>();
  walk(node, '', out);
  return out;
}

function walk(
  node: Record<string, unknown>,
  prefix: string,
  out: Map<string, string>,
): void {
  for (const [segment, value] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${segment}` : segment;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      walk(value as Record<string, unknown>, key, out);
    } else if (typeof value === 'string') {
      out.set(key, value);
    }
  }
}
