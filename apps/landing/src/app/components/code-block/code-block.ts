import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';

/**
 * A dark "night" code panel with an optional filename chrome bar and a
 * copy-to-clipboard control. Works for single-line commands and full snippets.
 */
@Component({
  selector: 'app-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `min-width: 0` lets the inner <pre> scroll instead of stretching grid/flex
  // tracks past the viewport on narrow screens.
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
  template: `
    <figure
      class="group relative overflow-hidden rounded-xl border border-night-line bg-night text-[0.85rem] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]"
    >
      @if (filename()) {
        <figcaption
          class="flex items-center gap-2 border-b border-night-line/80 px-4 py-2.5"
        >
          <span class="flex gap-1.5">
            <span class="size-2.5 rounded-full bg-paper/15"></span>
            <span class="size-2.5 rounded-full bg-paper/15"></span>
            <span class="size-2.5 rounded-full bg-amber/60"></span>
          </span>
          <span class="ml-1 font-mono text-xs tracking-tight text-paper/55">
            {{ filename() }}
          </span>
        </figcaption>
      }

      <button
        type="button"
        (click)="copy()"
        [attr.aria-label]="copied() ? 'Copied' : 'Copy code'"
        class="absolute right-2.5 z-10 inline-flex items-center gap-1.5 rounded-lg border border-night-line bg-night-soft px-2.5 py-1.5 font-sans text-xs font-medium text-paper/70 transition hover:border-amber/50 hover:text-amber-bright focus-visible:opacity-100"
        [class.top-2.5]="!filename()"
        [class.top-11]="filename()"
      >
        @if (copied()) {
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Copied
        } @else {
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          Copy
        }
      </button>

      <pre
        class="overflow-x-auto px-4 py-4 font-mono leading-relaxed text-paper/85"
        [class.pr-24]="!filename()"
      ><code>{{ code() }}</code></pre>
    </figure>
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly filename = input('');

  protected readonly copied = signal(false);

  protected copy(): void {
    void navigator.clipboard?.writeText(this.code()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    });
  }
}
