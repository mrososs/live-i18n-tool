import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nKeyDirective } from './i18n-key.directive';

@Component({
  imports: [I18nKeyDirective],
  template: `<h1 [li18nKey]="key()">Title</h1>`,
})
class HostComponent {
  readonly key = signal('demo.title');
}

describe('I18nKeyDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('reflects the key onto the data-i18n-key attribute', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.getAttribute('data-i18n-key')).toBe('demo.title');
  });

  it('updates the attribute when the key input changes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    fixture.componentInstance.key.set('demo.greeting');
    await fixture.whenStable();

    const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
    expect(h1.getAttribute('data-i18n-key')).toBe('demo.greeting');
  });
});
