import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { LIVE_TRANSLATIONS_CONFIG } from '../config/live-translations.config';
import { readKeyMarker } from './key-marker';

/** Attribute the tracker looks for — kept in sync with the directive/tracker. */
const I18N_KEY_ATTR = 'data-i18n-key';

/** Inspector chrome we must never tag (its own UI lives on document.body). */
const INSPECTOR_HOSTS =
  'li18n-inspector-overlay, li18n-inspector-editor, li18n-inspector-toggle';

/** A translation value containing `{{ … }}` placeholders, compiled to a regex. */
interface InterpolatedMatcher {
  key: string;
  pattern: RegExp;
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a translation value contains an interpolation placeholder. */
function hasPlaceholder(value: string): boolean {
  return /\{\{.*?\}\}/.test(value);
}

/**
 * Dev-only service that gives translated elements a `data-i18n-key` attribute
 * without requiring the host to annotate templates. It reverse-looks-up each
 * rendered text node against the loaded translation dictionary — matching exact
 * strings directly and interpolated values (`Hello, {{name}}!`) via a wildcard
 * regex — then tags the text node's parent element.
 *
 * A `MutationObserver` re-scans as the DOM and language change, coalesced to one
 * pass per animation frame. Manual {@link I18nKeyDirective} usage keeps working;
 * elements already carrying the attribute are left untouched.
 */
@Injectable({ providedIn: 'root' })
export class AutoTagService {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(LIVE_TRANSLATIONS_CONFIG, { optional: true });

  private observer: MutationObserver | null = null;
  private rafId: number | null = null;
  private started = false;

  /** Exact value → key (rebuilt each scan to follow language changes). */
  private exact = new Map<string, string>();
  /** Interpolated value matchers, tried after exact lookups miss. */
  private interpolated: InterpolatedMatcher[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  /** Start scanning + observing. Idempotent. */
  init(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.scan();

    const view = this.document.defaultView;
    if (view && 'MutationObserver' in view) {
      this.observer = new view.MutationObserver(() => this.scheduleScan());
      this.observer.observe(this.document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  /** Disconnect the observer and cancel any pending frame. */
  destroy(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    if (this.rafId !== null) {
      this.document.defaultView?.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleScan(): void {
    const view = this.document.defaultView;
    if (!view || this.rafId !== null) {
      return;
    }
    this.rafId = view.requestAnimationFrame(() => {
      this.rafId = null;
      this.scan();
    });
  }

  /** Rebuild the index from the current dictionary and tag matching elements. */
  private scan(): void {
    this.buildIndex();

    const walker = this.document.createTreeWalker(
      this.document.body,
      NodeFilter.SHOW_TEXT,
    );

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const raw = node.nodeValue;
      if (!raw) {
        continue;
      }
      const parent = node.parentElement;
      if (!parent || parent.closest(INSPECTOR_HOSTS)) {
        continue;
      }

      // Primary path: an invisible marker carries the *exact* key — this is the
      // only way to disambiguate two keys that render identical text. Strip the
      // marker so the DOM stays clean; Angular won't re-add it unless the bound
      // value actually changes (e.g. a language switch), which re-tags safely.
      const marked = readKeyMarker(raw);
      if (marked) {
        if (node.nodeValue !== marked.rest) {
          node.nodeValue = marked.rest;
        }
        if (!parent.hasAttribute(I18N_KEY_ATTR)) {
          parent.setAttribute(I18N_KEY_ATTR, marked.key);
        }
        continue;
      }

      // Fallback: reverse-match rendered text for un-marked nodes (static text,
      // or i18n libraries without the marker patch). First key wins on ties.
      if (parent.hasAttribute(I18N_KEY_ATTR)) {
        continue;
      }
      const text = raw.trim();
      if (!text) {
        continue;
      }
      const key = this.match(text);
      if (key) {
        parent.setAttribute(I18N_KEY_ATTR, key);
      }
    }
  }

  /** Find the translation key whose value renders as `text` (exact, then regex). */
  private match(text: string): string | null {
    const exact = this.exact.get(text);
    if (exact) {
      return exact;
    }
    for (const candidate of this.interpolated) {
      if (candidate.pattern.test(text)) {
        return candidate.key;
      }
    }
    return null;
  }

  private buildIndex(): void {
    this.exact = new Map();
    this.interpolated = [];

    const translations = this.config?.getTranslations?.() ?? {};
    this.flatten(translations, '');
  }

  /** Walk the nested dictionary into flat `a.b.c` keys, indexing each value. */
  private flatten(node: Record<string, unknown>, prefix: string): void {
    for (const [segment, value] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${segment}` : segment;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.flatten(value as Record<string, unknown>, key);
      } else if (typeof value === 'string') {
        this.index(key, value);
      }
    }
  }

  private index(key: string, value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (hasPlaceholder(trimmed)) {
      const pattern = escapeRegExp(trimmed).replace(/\\\{\\\{.*?\\\}\\\}/g, '.*?');
      this.interpolated.push({ key, pattern: new RegExp(`^${pattern}$`) });
    } else if (!this.exact.has(trimmed)) {
      // First key wins on duplicate text (acceptable for a dev tool).
      this.exact.set(trimmed, key);
    }
  }
}
