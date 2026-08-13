import type { EnvironmentProviders } from '@angular/core';
import { type LiveTranslationsInput, provideLiveTranslationsInternal } from '@live-i18n/client';

const TOKEN_KEY = 'live-i18n.session-token';
const CONTEXT_KEY = 'live-i18n.session-context';

interface SessionContext {
  projectId: string;
  environmentId: string;
  catalogSnapshotId: string;
  changeSetId: string;
  changeSetRevision: number;
}

export interface StagingLiveTranslationsOptions {
  /** Private Pilot API origin, for example `https://live-i18n.example/api`. */
  apiBaseUrl: string;
  /** Legacy explicit context remains supported during migration. */
  projectId?: string;
  environmentId?: string;
  catalogSnapshotId?: string;
  /** Legacy token reader remains supported during migration. */
  getSessionToken?: () => string | null;
  storage?: Storage;
}

function takeLaunchCode(): string | null {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const code = fragment.get('live-i18n-code');
  if (!code) return null;
  fragment.delete('live-i18n-code');
  const nextHash = fragment.toString();
  history.replaceState(history.state, '', `${location.pathname}${location.search}${nextHash ? `#${nextHash}` : ''}`);
  return code;
}

/**
 * Enables the authoring overlay only in an explicitly selected staging build.
 * A launch code in the URL fragment is exchanged once, removed immediately,
 * and replaced with an origin-bound bearer token stored in sessionStorage.
 */
export function provideStagingLiveTranslations(
  adapter: LiveTranslationsInput,
  options: StagingLiveTranslationsOptions,
): EnvironmentProviders {
  const apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
  const storage = options.storage ?? sessionStorage;
  let context: SessionContext = {
    projectId: options.projectId ?? '',
    environmentId: options.environmentId ?? '',
    catalogSnapshotId: options.catalogSnapshotId ?? '',
    changeSetId: '',
    changeSetRevision: 0,
  };

  const readToken = () => options.getSessionToken?.() ?? storage.getItem(TOKEN_KEY);
  const bootstrap = async () => {
    const stored = storage.getItem(CONTEXT_KEY);
    if (stored) context = JSON.parse(stored) as SessionContext;
    const code = takeLaunchCode();
    if (!code) return;
    const response = await fetch(`${apiBaseUrl}/edit-sessions/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error(`[live-i18n] Launch code exchange failed (HTTP ${response.status}).`);
    const exchanged = (await response.json()) as { token: string } & SessionContext;
    context = exchanged;
    storage.setItem(TOKEN_KEY, exchanged.token);
    storage.setItem(CONTEXT_KEY, JSON.stringify(context));
  };

  return provideLiveTranslationsInternal(
    adapter,
    () => Boolean(readToken()),
    {
      authoringMode: 'staging',
      endpoint: `${apiBaseUrl}/change-entries`,
      get projectId() { return context.projectId; },
      get environmentId() { return context.environmentId; },
      get catalogSnapshotId() { return context.catalogSnapshotId; },
      getSessionToken: readToken,
    },
    bootstrap,
  );
}
