import { ApplicationInitStatus, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideLiveTranslations } from './provide-live-translations';
import { InspectorTrackingService } from './tracking/inspector-tracking.service';

describe('provideLiveTranslations', () => {
  let initSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    initSpy = vi.spyOn(InspectorTrackingService.prototype, 'init');
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideLiveTranslations()],
    });
  });

  afterEach(() => {
    document
      .querySelectorAll(
        'li18n-inspector-overlay, li18n-inspector-editor, li18n-inspector-toggle',
      )
      .forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('mounts the overlay, editor and toggle onto document.body during app init', async () => {
    // Running the app initializers triggers the mount logic.
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(document.querySelector('li18n-inspector-overlay')).not.toBeNull();
    expect(document.querySelector('li18n-inspector-editor')).not.toBeNull();
    expect(document.querySelector('li18n-inspector-toggle')).not.toBeNull();
  });

  it('starts the global event tracker', async () => {
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(initSpy).toHaveBeenCalledTimes(1);
  });
});
