import { Component, computed, signal } from '@angular/core';
import {
  assertReviewerSeparation,
  ChangeEntry,
  ChangeSet,
  ChangeSetStatus,
  createApprovedChangeManifest,
  LIVE_I18N_PROTOCOL_VERSION,
  QaIssue,
  runDeterministicQa,
} from '@live-i18n/protocol';

type DemoRole = 'editor' | 'reviewer' | 'developer';

interface ActivityItem {
  actor: string;
  detail: string;
  time: string;
}

const ORIGINAL_EN = 'Checkout';
const ORIGINAL_AR = 'إتمام الطلب';
const EN_SUGGESTION = 'Complete your order securely';
const AR_SUGGESTION = 'أكمل طلبك بأمان';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly roles: ReadonlyArray<{
    id: DemoRole;
    label: string;
    eyebrow: string;
  }> = [
    { id: 'editor', label: 'Content editor', eyebrow: '1 · Edit' },
    { id: 'reviewer', label: 'Reviewer', eyebrow: '2 · Review' },
    { id: 'developer', label: 'Developer', eyebrow: '3 · Deliver' },
  ];

  protected readonly role = signal<DemoRole>('editor');
  protected readonly status = signal<ChangeSetStatus>('draft');
  protected readonly englishValue = signal(ORIGINAL_EN);
  protected readonly arabicValue = signal(ORIGINAL_AR);
  protected readonly arabicReconfirmed = signal(false);
  protected readonly reviewNote = signal('');
  protected readonly copied = signal(false);
  protected readonly activity = signal<ActivityItem[]>([
    {
      actor: 'Live i18n',
      detail: 'Protected edit session opened from the test environment.',
      time: 'Now',
    },
  ]);

  protected readonly sourceChanged = computed(
    () => this.englishValue() !== ORIGINAL_EN,
  );
  protected readonly arabicChanged = computed(
    () => this.arabicValue() !== ORIGINAL_AR,
  );
  protected readonly hasChanges = computed(
    () => this.sourceChanged() || this.arabicChanged(),
  );
  protected readonly requiredLocaleState = computed(() => {
    if (!this.sourceChanged() || this.arabicChanged())
      return 'current' as const;
    return this.arabicReconfirmed() ? 'reconfirmed' : ('outdated' as const);
  });

  protected readonly qaIssues = computed<QaIssue[]>(() => [
    ...runDeterministicQa({
      entryId: 'entry-en',
      sourceValue: ORIGINAL_EN,
      targetValue: this.englishValue(),
      required: true,
      characterLimit: 42,
    }),
    ...runDeterministicQa({
      entryId: 'entry-ar',
      sourceValue: this.englishValue(),
      targetValue: this.arabicValue(),
      required: true,
      requiredLocaleState: this.requiredLocaleState(),
      characterLimit: 42,
    }),
  ]);
  protected readonly canSubmit = computed(
    () => this.hasChanges() && this.qaIssues().length === 0,
  );

  protected readonly changeSet = computed<ChangeSet>(() => {
    const now = new Date().toISOString();
    const entries: ChangeEntry[] = [
      {
        id: 'entry-en',
        locale: 'en',
        filePath: 'src/assets/i18n/en.json',
        key: 'checkout.title',
        keySegments: ['checkout', 'title'],
        jsonPointer: '/checkout/title',
        originalValue: ORIGINAL_EN,
        newValue: this.englishValue(),
        originalValueRevision: 'sha256:demo-en',
        revision: 2,
        requiredLocaleState: 'current',
      },
      {
        id: 'entry-ar',
        locale: 'ar',
        filePath: 'src/assets/i18n/ar.json',
        key: 'checkout.title',
        keySegments: ['checkout', 'title'],
        jsonPointer: '/checkout/title',
        originalValue: ORIGINAL_AR,
        newValue: this.arabicValue(),
        originalValueRevision: 'sha256:demo-ar',
        revision: 2,
        requiredLocaleState: this.requiredLocaleState(),
      },
    ];
    return {
      protocolVersion: LIVE_I18N_PROTOCOL_VERSION,
      id: 'CS-1042',
      projectId: 'isaned-revamp',
      environmentId: 'test',
      baseRevision: 'azure-main@8f2a91c',
      catalogSnapshotId: 'catalog-2026-08-13-01',
      authorId: 'mariam.content',
      status: this.status(),
      revision: 3,
      entries: entries.filter(
        (entry) => entry.originalValue !== entry.newValue,
      ),
      createdAt: now,
      updatedAt: now,
    };
  });

  protected readonly manifest = computed(() => {
    if (this.status() !== 'approved') return null;
    return createApprovedChangeManifest({
      changeSet: this.changeSet(),
      configHash: 'sha256:demo-config',
      approvedAt: new Date().toISOString(),
    });
  });
  protected readonly manifestJson = computed(() =>
    this.manifest() ? JSON.stringify(this.manifest(), null, 2) : '',
  );

  protected selectRole(role: DemoRole): void {
    this.role.set(role);
    this.copied.set(false);
  }

  protected updateEnglish(event: Event): void {
    this.englishValue.set((event.target as HTMLTextAreaElement).value);
    this.arabicReconfirmed.set(false);
    this.returnToDraftAfterRequestedChanges();
  }

  protected updateArabic(event: Event): void {
    this.arabicValue.set((event.target as HTMLTextAreaElement).value);
    this.returnToDraftAfterRequestedChanges();
  }

  protected applyEnglishSuggestion(): void {
    this.englishValue.set(EN_SUGGESTION);
    this.arabicReconfirmed.set(false);
    this.addActivity('Mariam · Editor', 'Applied the English AI suggestion.');
  }

  protected applyArabicSuggestion(): void {
    this.arabicValue.set(AR_SUGGESTION);
    this.addActivity('Mariam · Editor', 'Applied the Arabic AI suggestion.');
  }

  protected reconfirmArabic(): void {
    this.arabicReconfirmed.set(true);
    this.addActivity(
      'Mariam · Editor',
      'Reconfirmed the existing Arabic translation.',
    );
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.status.set('submitted');
    this.reviewNote.set('');
    this.addActivity('Mariam · Editor', 'Submitted Change Set CS-1042.');
    this.role.set('reviewer');
  }

  protected requestChanges(): void {
    this.status.set('changes_requested');
    this.reviewNote.set('Please use a warmer tone in the English headline.');
    this.addActivity('Omar · Reviewer', 'Requested changes with a comment.');
    this.role.set('editor');
  }

  protected approve(): void {
    assertReviewerSeparation('mariam.content', 'omar.reviewer');
    this.status.set('approved');
    this.reviewNote.set('Approved for developer delivery.');
    this.addActivity('Omar · Reviewer', 'Approved Change Set CS-1042.');
    this.role.set('developer');
  }

  protected async copyManifest(): Promise<void> {
    await navigator.clipboard.writeText(this.manifestJson());
    this.copied.set(true);
  }

  protected downloadManifest(): void {
    const blob = new Blob([this.manifestJson()], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'CS-1042.live-i18n.json';
    anchor.click();
    URL.revokeObjectURL(url);
    this.addActivity('Developer', 'Downloaded the approved change manifest.');
  }

  protected resetDemo(): void {
    this.role.set('editor');
    this.status.set('draft');
    this.englishValue.set(ORIGINAL_EN);
    this.arabicValue.set(ORIGINAL_AR);
    this.arabicReconfirmed.set(false);
    this.reviewNote.set('');
    this.copied.set(false);
    this.activity.set([
      {
        actor: 'Live i18n',
        detail: 'Protected edit session opened from the test environment.',
        time: 'Now',
      },
    ]);
  }

  private returnToDraftAfterRequestedChanges(): void {
    if (this.status() === 'changes_requested') this.status.set('draft');
  }

  private addActivity(actor: string, detail: string): void {
    this.activity.update((items) => [...items, { actor, detail, time: 'Now' }]);
  }
}
