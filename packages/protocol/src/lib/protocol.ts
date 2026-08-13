/** Current wire format shared by the editor, Studio, API, exports, and CLI. */
export const LIVE_I18N_PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof LIVE_I18N_PROTOCOL_VERSION;
export type MemberRole = 'admin' | 'editor' | 'reviewer';
export type ChangeSetStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'approved';
export type QaSeverity = 'error' | 'warning';
export type ReviewDecisionType = 'approved' | 'changes_requested';

export interface LiveI18nProjectConfig {
  schemaVersion: ProtocolVersion;
  projectId: string;
  environmentId: string;
  sourceLocale: string;
  requiredLocales: string[];
  keyMode: 'nested';
  files: Record<string, string[]>;
  characterLimits?: Record<string, number>;
}

export interface CatalogEntry {
  locale: string;
  filePath: string;
  key: string;
  keySegments: string[];
  jsonPointer: string;
  value: string;
  valueRevision: string;
}

export interface CatalogFile {
  locale: string;
  filePath: string;
  contentRevision: string;
  encoding: 'utf-8' | 'utf-8-bom';
  eol: 'lf' | 'crlf';
  trailingNewline: boolean;
  entries: CatalogEntry[];
}

export interface CatalogSnapshot {
  protocolVersion: ProtocolVersion;
  projectId: string;
  environmentId: string;
  baseRevision: string;
  configHash: string;
  files: CatalogFile[];
  createdAt: string;
}

export interface EditSession {
  protocolVersion: ProtocolVersion;
  id: string;
  projectId: string;
  environmentId: string;
  catalogSnapshotId: string;
  origin: string;
  expiresAt: string;
}

export interface TranslationContext {
  projectId: string;
  environmentId: string;
  catalogSnapshotId: string;
  sourceLocale: string;
  requiredLocales: string[];
  locale: string;
  filePath: string;
  key: string;
  keySegments: string[];
  jsonPointer: string;
  value: string;
  valueRevision: string;
}

export interface ChangeEntry {
  id: string;
  locale: string;
  filePath: string;
  key: string;
  keySegments: string[];
  jsonPointer: string;
  originalValue: string;
  newValue: string;
  originalValueRevision: string;
  revision: number;
  requiredLocaleState: 'current' | 'outdated' | 'reconfirmed';
}

export interface ChangeSet {
  protocolVersion: ProtocolVersion;
  id: string;
  projectId: string;
  environmentId: string;
  baseRevision: string;
  catalogSnapshotId: string;
  authorId: string;
  status: ChangeSetStatus;
  revision: number;
  entries: ChangeEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface QaIssue {
  code:
    | 'placeholder_mismatch'
    | 'invalid_icu'
    | 'html_mismatch'
    | 'empty_required_value'
    | 'required_locale_outdated'
    | 'unsafe_whitespace'
    | 'character_limit';
  severity: QaSeverity;
  message: string;
  entryId: string;
}

export interface QaResult {
  id: string;
  changeSetId: string;
  changeSetRevision: number;
  passed: boolean;
  issues: QaIssue[];
  createdAt: string;
}

export interface AiSuggestion {
  id: string;
  changeEntryId: string;
  operation: 'translate' | 'rephrase' | 'shorten' | 'tone';
  suggestedValue: string;
  reason: string;
  warnings: string[];
  status: 'generated' | 'applied' | 'rejected';
  createdAt: string;
}

export interface ReviewDecision {
  id: string;
  changeSetId: string;
  changeSetRevision: number;
  reviewerId: string;
  decision: ReviewDecisionType;
  comment?: string;
  createdAt: string;
}

export interface ApprovedChange {
  locale: string;
  filePath: string;
  key: string;
  keySegments: string[];
  jsonPointer: string;
  originalValue: string;
  newValue: string;
  originalValueRevision: string;
}

export interface ApprovedChangeManifest {
  schemaVersion: ProtocolVersion;
  changeSetId: string;
  projectId: string;
  baseRevision: string;
  configHash: string;
  approvedAt: string;
  changes: ApprovedChange[];
}

export interface SourceControlProvider {
  getFile(input: GetFileInput): Promise<VersionedFile>;
  getRevision(input: GetRevisionInput): Promise<Revision>;
  createBranch(input: CreateBranchInput): Promise<BranchRef>;
  commitFiles(input: CommitFilesInput): Promise<CommitResult>;
  createPullRequest(input: CreatePullRequestInput): Promise<PullRequestRef>;
}

export interface GetFileInput {
  repositoryId: string;
  revision: string;
  path: string;
}

export interface VersionedFile {
  path: string;
  content: string;
  revision: string;
}

export interface GetRevisionInput {
  repositoryId: string;
  reference: string;
}

export interface Revision {
  id: string;
}

export interface CreateBranchInput {
  repositoryId: string;
  name: string;
  fromRevision: string;
}

export interface BranchRef {
  name: string;
  revision: string;
}

export interface CommitFilesInput {
  repositoryId: string;
  branch: string;
  expectedRevision: string;
  message: string;
  files: Array<{ path: string; content: string }>;
}

export interface CommitResult {
  revision: string;
}

export interface CreatePullRequestInput {
  repositoryId: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
}

export interface PullRequestRef {
  id: string;
  url: string;
}

export class ProtocolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolValidationError';
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProtocolValidationError(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function stringField(value: JsonObject, name: string): string {
  const field = value[name];
  if (typeof field !== 'string' || field.length === 0) {
    throw new ProtocolValidationError(`${name} must be a non-empty string.`);
  }
  return field;
}

function numberField(value: JsonObject, name: string): number {
  const field = value[name];
  if (!Number.isInteger(field) || (field as number) < 0) {
    throw new ProtocolValidationError(
      `${name} must be a non-negative integer.`,
    );
  }
  return field as number;
}

function stringArrayField(value: JsonObject, name: string): string[] {
  const field = value[name];
  if (!Array.isArray(field) || field.some((item) => typeof item !== 'string')) {
    throw new ProtocolValidationError(`${name} must be an array of strings.`);
  }
  return field as string[];
}

function protocolVersion(value: JsonObject, name: string): void {
  if (value[name] !== LIVE_I18N_PROTOCOL_VERSION) {
    throw new ProtocolValidationError(
      `${name} must be ${LIVE_I18N_PROTOCOL_VERSION}.`,
    );
  }
}

/** Parse the declarative, nested-JSON-only Pilot project configuration. */
export function parseLiveI18nProjectConfig(
  input: unknown,
): LiveI18nProjectConfig {
  const value = object(input, 'Live i18n project configuration');
  protocolVersion(value, 'schemaVersion');
  if (value['keyMode'] !== 'nested') {
    throw new ProtocolValidationError(
      'keyMode must be "nested" for the Pilot.',
    );
  }
  const filesValue = object(value['files'], 'files');
  const files: Record<string, string[]> = {};
  for (const [locale, paths] of Object.entries(filesValue)) {
    if (
      !Array.isArray(paths) ||
      paths.length === 0 ||
      paths.some(
        (path) =>
          typeof path !== 'string' ||
          path.length === 0 ||
          path.startsWith('/') ||
          path.includes('..') ||
          !path.endsWith('.json'),
      )
    ) {
      throw new ProtocolValidationError(
        `files.${locale} must contain safe repository-relative JSON paths.`,
      );
    }
    files[locale] = [...paths] as string[];
  }

  const sourceLocale = stringField(value, 'sourceLocale');
  const requiredLocales = stringArrayField(value, 'requiredLocales');
  for (const locale of [sourceLocale, ...requiredLocales]) {
    if (!files[locale]) {
      throw new ProtocolValidationError(
        `Locale "${locale}" does not have an allowlisted translation file.`,
      );
    }
  }

  let characterLimits: Record<string, number> | undefined;
  if (value['characterLimits'] !== undefined) {
    const limits = object(value['characterLimits'], 'characterLimits');
    characterLimits = {};
    for (const [key, limit] of Object.entries(limits)) {
      if (!Number.isInteger(limit) || (limit as number) <= 0) {
        throw new ProtocolValidationError(
          `characterLimits.${key} must be a positive integer.`,
        );
      }
      characterLimits[key] = limit as number;
    }
  }

  return {
    schemaVersion: LIVE_I18N_PROTOCOL_VERSION,
    projectId: stringField(value, 'projectId'),
    environmentId: stringField(value, 'environmentId'),
    sourceLocale,
    requiredLocales,
    keyMode: 'nested',
    files,
    ...(characterLimits ? { characterLimits } : {}),
  };
}

/** Parse an untrusted approved export manifest into the stable Pilot contract. */
export function parseApprovedChangeManifest(
  input: unknown,
): ApprovedChangeManifest {
  const value = object(input, 'Approved change manifest');
  protocolVersion(value, 'schemaVersion');
  const rawChanges = value['changes'];
  if (!Array.isArray(rawChanges)) {
    throw new ProtocolValidationError('changes must be an array.');
  }

  const changes = rawChanges.map((raw, index): ApprovedChange => {
    const change = object(raw, `changes[${index}]`);
    return {
      locale: stringField(change, 'locale'),
      filePath: stringField(change, 'filePath'),
      key: stringField(change, 'key'),
      keySegments: stringArrayField(change, 'keySegments'),
      jsonPointer: stringField(change, 'jsonPointer'),
      originalValue: stringFieldAllowEmpty(change, 'originalValue'),
      newValue: stringFieldAllowEmpty(change, 'newValue'),
      originalValueRevision: stringField(change, 'originalValueRevision'),
    };
  });

  return {
    schemaVersion: LIVE_I18N_PROTOCOL_VERSION,
    changeSetId: stringField(value, 'changeSetId'),
    projectId: stringField(value, 'projectId'),
    baseRevision: stringField(value, 'baseRevision'),
    configHash: stringField(value, 'configHash'),
    approvedAt: stringField(value, 'approvedAt'),
    changes,
  };
}

/** Parse an untrusted Change Set and reject incompatible or partial payloads. */
export function parseChangeSet(input: unknown): ChangeSet {
  const value = object(input, 'Change Set');
  protocolVersion(value, 'protocolVersion');
  const status = stringField(value, 'status');
  if (
    !['draft', 'submitted', 'changes_requested', 'approved'].includes(status)
  ) {
    throw new ProtocolValidationError(
      `Unsupported Change Set status "${status}".`,
    );
  }
  const rawEntries = value['entries'];
  if (!Array.isArray(rawEntries)) {
    throw new ProtocolValidationError('entries must be an array.');
  }

  const entries = rawEntries.map((raw, index): ChangeEntry => {
    const entry = object(raw, `entries[${index}]`);
    const requiredLocaleState = stringField(entry, 'requiredLocaleState');
    if (!['current', 'outdated', 'reconfirmed'].includes(requiredLocaleState)) {
      throw new ProtocolValidationError(
        `Unsupported requiredLocaleState "${requiredLocaleState}".`,
      );
    }
    return {
      id: stringField(entry, 'id'),
      locale: stringField(entry, 'locale'),
      filePath: stringField(entry, 'filePath'),
      key: stringField(entry, 'key'),
      keySegments: stringArrayField(entry, 'keySegments'),
      jsonPointer: stringField(entry, 'jsonPointer'),
      originalValue: stringFieldAllowEmpty(entry, 'originalValue'),
      newValue: stringFieldAllowEmpty(entry, 'newValue'),
      originalValueRevision: stringField(entry, 'originalValueRevision'),
      revision: numberField(entry, 'revision'),
      requiredLocaleState:
        requiredLocaleState as ChangeEntry['requiredLocaleState'],
    };
  });

  return {
    protocolVersion: LIVE_I18N_PROTOCOL_VERSION,
    id: stringField(value, 'id'),
    projectId: stringField(value, 'projectId'),
    environmentId: stringField(value, 'environmentId'),
    baseRevision: stringField(value, 'baseRevision'),
    catalogSnapshotId: stringField(value, 'catalogSnapshotId'),
    authorId: stringField(value, 'authorId'),
    status: status as ChangeSetStatus,
    revision: numberField(value, 'revision'),
    entries,
    createdAt: stringField(value, 'createdAt'),
    updatedAt: stringField(value, 'updatedAt'),
  };
}

/** Allowed workflow transitions. Approval is intentionally terminal. */
export function canTransitionChangeSet(
  from: ChangeSetStatus,
  to: ChangeSetStatus,
): boolean {
  return (
    (from === 'draft' && to === 'submitted') ||
    (from === 'changes_requested' && to === 'submitted') ||
    (from === 'submitted' && (to === 'changes_requested' || to === 'approved'))
  );
}

/** Enforce reviewer separation in the shared domain contract. */
export function assertReviewerSeparation(
  authorId: string,
  reviewerId: string,
): void {
  if (authorId === reviewerId) {
    throw new ProtocolValidationError(
      'A Change Set author cannot approve or review their own submission.',
    );
  }
}

export interface QaInput {
  entryId: string;
  sourceValue: string;
  targetValue: string;
  required?: boolean;
  requiredLocaleState?: ChangeEntry['requiredLocaleState'];
  characterLimit?: number;
}

/**
 * Deterministic, provider-independent checks that are safe to run in the
 * browser, API, or CLI. The API remains authoritative for submission.
 */
export function runDeterministicQa(input: QaInput): QaIssue[] {
  const issues: QaIssue[] = [];
  const push = (issue: Omit<QaIssue, 'entryId'>): void => {
    issues.push({ ...issue, entryId: input.entryId });
  };

  if (input.required && input.targetValue.length === 0) {
    push({
      code: 'empty_required_value',
      severity: 'error',
      message: 'A required translation cannot be empty.',
    });
  }
  if (input.requiredLocaleState === 'outdated') {
    push({
      code: 'required_locale_outdated',
      severity: 'error',
      message:
        'This required locale must be updated or explicitly reconfirmed.',
    });
  }
  if (
    input.characterLimit !== undefined &&
    input.targetValue.length > input.characterLimit
  ) {
    push({
      code: 'character_limit',
      severity: 'error',
      message: `Translation exceeds the ${input.characterLimit}-character limit.`,
    });
  }

  const sourcePlaceholders = extractPlaceholders(input.sourceValue);
  const targetPlaceholders = extractPlaceholders(input.targetValue);
  if (!sameMultiset(sourcePlaceholders, targetPlaceholders)) {
    push({
      code: 'placeholder_mismatch',
      severity: 'error',
      message: 'Interpolation placeholders do not match the source value.',
    });
  }

  const sourceTags = extractHtmlTags(input.sourceValue);
  const targetTags = extractHtmlTags(input.targetValue);
  if (!sameMultiset(sourceTags, targetTags)) {
    push({
      code: 'html_mismatch',
      severity: 'error',
      message: 'HTML tags do not match the source value.',
    });
  }
  if (
    input.targetValue !== input.targetValue.trim() ||
    hasUnsafeControlCharacter(input.targetValue)
  ) {
    push({
      code: 'unsafe_whitespace',
      severity: 'error',
      message:
        'Translation contains unsafe control characters or edge whitespace.',
    });
  }
  if (!hasBalancedBraces(input.targetValue)) {
    push({
      code: 'invalid_icu',
      severity: 'error',
      message: 'Translation has unbalanced ICU/message braces.',
    });
  }

  return issues;
}

/** Build an immutable export manifest from the exact approved revision. */
export function createApprovedChangeManifest(input: {
  changeSet: ChangeSet;
  configHash: string;
  approvedAt: string;
}): ApprovedChangeManifest {
  if (input.changeSet.status !== 'approved') {
    throw new ProtocolValidationError(
      'Only an approved Change Set can be exported.',
    );
  }
  return {
    schemaVersion: LIVE_I18N_PROTOCOL_VERSION,
    changeSetId: input.changeSet.id,
    projectId: input.changeSet.projectId,
    baseRevision: input.changeSet.baseRevision,
    configHash: input.configHash,
    approvedAt: input.approvedAt,
    changes: input.changeSet.entries.map((entry) => ({
      locale: entry.locale,
      filePath: entry.filePath,
      key: entry.key,
      keySegments: [...entry.keySegments],
      jsonPointer: entry.jsonPointer,
      originalValue: entry.originalValue,
      newValue: entry.newValue,
      originalValueRevision: entry.originalValueRevision,
    })),
  };
}

export interface JsonPatchOperation {
  op: 'test' | 'replace';
  path: string;
  value: string;
}

/** Group safe `test` + `replace` patches by allowlisted translation file. */
export function createJsonPatches(
  manifest: ApprovedChangeManifest,
): Record<string, JsonPatchOperation[]> {
  const files: Record<string, JsonPatchOperation[]> = {};
  for (const change of manifest.changes) {
    const operations = (files[change.filePath] ??= []);
    operations.push(
      { op: 'test', path: change.jsonPointer, value: change.originalValue },
      { op: 'replace', path: change.jsonPointer, value: change.newValue },
    );
  }
  return files;
}

function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
    .map((match) => match[1].trim())
    .sort();
}

function extractHtmlTags(value: string): string[] {
  return [...value.matchAll(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g)]
    .map((match) => (match[0].startsWith('</') ? `/${match[1]}` : match[1]))
    .sort();
}

function sameMultiset(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((item, i) => item === right[i])
  );
}

function hasBalancedBraces(value: string): boolean {
  let depth = 0;
  for (const character of value.replace(/\{\{[^{}]*\}\}/g, '')) {
    if (character === '{') depth++;
    if (character === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function hasUnsafeControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)
    );
  });
}

function stringFieldAllowEmpty(value: JsonObject, name: string): string {
  const field = value[name];
  if (typeof field !== 'string') {
    throw new ProtocolValidationError(`${name} must be a string.`);
  }
  return field;
}
