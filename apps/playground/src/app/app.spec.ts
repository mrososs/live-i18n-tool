import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        importProvidersFrom(
          TranslocoTestingModule.forRoot({
            langs: { en: {}, ar: {} },
            translocoConfig: { defaultLang: 'en' },
          }),
        ),
      ],
    }).compileComponents();
  });

  it('should render the hero title element', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero__title')).not.toBeNull();
  });
});
