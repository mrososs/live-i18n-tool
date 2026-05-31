/**
 * Zero-width "key marker" encoding.
 *
 * The auto-tagger normally reverse-matches rendered text against the loaded
 * dictionary to discover each element's translation key. That breaks down when
 * two different keys share the same text — the value alone can't tell them
 * apart. To resolve this without any template annotation, we let the i18n
 * pipe/directive prepend an *invisible* marker that encodes the real key onto
 * the rendered string (see {@link enableKeyMarkers}). The auto-tagger then reads
 * the key straight off the text node and strips the marker again.
 *
 * The marker is built from characters that are invisible AND have no text
 * effect: we deliberately avoid U+200C/U+200D (ZWNJ/ZWJ) because those alter
 * Arabic/Persian letter shaping. We also avoid U+FEFF as a delimiter because
 * `String.prototype.trim()` strips it, which would corrupt the marker.
 */

/** Marks the start/end of an encoded key. ZERO WIDTH SPACE — not trimmed. */
const DELIM = String.fromCharCode(0x200b); // ZERO WIDTH SPACE
/** Binary `0`. WORD JOINER — invisible, no joining behaviour. */
const BIT0 = String.fromCharCode(0x2060); // WORD JOINER
/** Binary `1`. FUNCTION APPLICATION — invisible, default-ignorable. */
const BIT1 = String.fromCharCode(0x2061); // FUNCTION APPLICATION

/** id → key and key → id registries, populated lazily as keys are rendered. */
const idToKey = new Map<number, string>();
const keyToId = new Map<string, number>();
let nextId = 0;

/** Encode a non-negative integer as a `BIT0`/`BIT1` string. */
function encodeId(id: number): string {
  let out = '';
  for (const bit of id.toString(2)) {
    out += bit === '1' ? BIT1 : BIT0;
  }
  return out;
}

/** Return (creating if needed) the stable marker string for `key`. */
function markerFor(key: string): string {
  let id = keyToId.get(key);
  if (id === undefined) {
    id = nextId++;
    keyToId.set(key, id);
    idToKey.set(id, key);
  }
  return `${DELIM}${encodeId(id)}${DELIM}`;
}

/** Prepend `key`'s invisible marker to `value`. */
export function wrapValueWithKey(key: string, value: string): string {
  return markerFor(key) + value;
}

/**
 * The minimal shape of a translation pipe: a `transform(key, …)` that returns
 * the rendered string. Declared structurally so this library keeps zero
 * dependency on any specific i18n package (e.g. `@ngx-translate/core`).
 */
export interface TranslatePipeLike {
  prototype: {
    transform(query: unknown, ...args: unknown[]): unknown;
    /** Set once patched, to make {@link enableKeyMarkers} idempotent. */
    __liveI18nKeyMarkersPatched?: boolean;
  };
}

/**
 * Patch a translation pipe so every string it renders is prefixed with an
 * invisible {@link wrapValueWithKey | key marker}. This is what lets the
 * auto-tagger recover the *exact* key per element — including when two keys
 * share the same text — without any template annotation.
 *
 * Call once at startup, passing your i18n library's pipe class:
 *
 * ```ts
 * import { TranslatePipe } from '@ngx-translate/core';
 * enableKeyMarkers(TranslatePipe);
 * ```
 *
 * Only string results for string queries are wrapped; arrays/objects pass
 * through untouched. Idempotent, and a no-op when `enabled` is false (pass
 * `isDevMode()` so production builds stay clean).
 */
export function enableKeyMarkers(
  pipe: TranslatePipeLike,
  enabled = true,
): void {
  if (!enabled) {
    return;
  }
  const proto = pipe.prototype;
  if (proto.__liveI18nKeyMarkersPatched) {
    return;
  }
  const original = proto.transform;
  proto.transform = function (query: unknown, ...args: unknown[]): unknown {
    const value = original.apply(this, [query, ...args]);
    if (typeof value === 'string' && typeof query === 'string') {
      return wrapValueWithKey(query, value);
    }
    return value;
  };
  proto.__liveI18nKeyMarkersPatched = true;
}

/** A decoded marker: the real translation key and the text that followed it. */
export interface DecodedKeyMarker {
  key: string;
  /** The original text with the marker removed. */
  rest: string;
}

/**
 * Read a key marker out of `text`. The marker is usually at the start, but
 * Angular's template whitespace handling can prepend a space (e.g. a `<button>`
 * whose interpolation sits on its own indented line renders ` <marker>Save `),
 * so we locate it anywhere and preserve the surrounding text in `rest`. Returns
 * `null` for un-marked nodes (the common case).
 */
export function readKeyMarker(text: string): DecodedKeyMarker | null {
  const start = text.indexOf(DELIM);
  if (start < 0) {
    return null;
  }
  const end = text.indexOf(DELIM, start + 1);
  if (end <= start + 1) {
    return null; // No id bits between the delimiters.
  }

  let binary = '';
  for (let i = start + 1; i < end; i++) {
    const ch = text.charAt(i);
    if (ch === BIT0) {
      binary += '0';
    } else if (ch === BIT1) {
      binary += '1';
    } else {
      return null; // Foreign character inside the marker — not ours.
    }
  }

  const id = parseInt(binary, 2);
  const key = idToKey.get(id);
  if (key === undefined) {
    return null;
  }
  return { key, rest: text.slice(0, start) + text.slice(end + 1) };
}
