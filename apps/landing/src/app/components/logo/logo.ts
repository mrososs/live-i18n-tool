import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Live i18n wordmark. The mark is a small "editor viewport": three lines of
 * text where the middle line is the highlighted translated string, tipped with
 * a blinking amber caret — the product, in 32px.
 */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2.5 align-middle">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        class="shrink-0"
      >
        <rect x="2.5" y="2.5" width="35" height="35" rx="9.5" class="fill-ink" />
        <rect
          x="9.5"
          y="12.5"
          width="18"
          height="2.6"
          rx="1.3"
          class="fill-paper"
          opacity="0.42"
        />
        <rect
          x="9.5"
          y="18.6"
          width="13"
          height="3"
          rx="1.5"
          class="fill-amber-bright"
        />
        <rect
          x="24.1"
          y="16.9"
          width="1.8"
          height="6.4"
          rx="0.9"
          class="fill-amber-bright"
          [class.caret]="animate()"
        />
        <rect
          x="9.5"
          y="25"
          width="10.5"
          height="2.6"
          rx="1.3"
          class="fill-paper"
          opacity="0.42"
        />
      </svg>

      @if (showWordmark()) {
        <span
          class="font-display text-[1.28rem] leading-none tracking-tight text-ink"
        >
          <span class="italic text-ochre">live</span
          ><span class="text-ink/35">·</span>i18n
        </span>
      }
    </span>
  `,
  styles: `
    @media (prefers-reduced-motion: no-preference) {
      .caret {
        animation: caret-blink 1.15s steps(1) infinite;
      }
    }
  `,
})
export class Logo {
  readonly size = input(34);
  readonly showWordmark = input(true);
  readonly animate = input(true);
}
