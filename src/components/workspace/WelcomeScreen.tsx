import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitUserFromToken, fetchRepoList } from '../../infrastructure/GitProviderApi';
import type { GitRepo, GitUserInfo } from '../../infrastructure/GitProviderApi';

type Step = 'auth' | 'workspace';

interface WelcomeScreenProps {
  onCreateWorkspace: (name: string, token?: string) => void;
  onCloneRepo?: (url: string, name: string, token?: string) => void;
}

export function WelcomeScreen({ onCreateWorkspace, onCloneRepo }: WelcomeScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('auth');
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [userInfo, setUserInfo] = useState<GitUserInfo | null>(null);
  const [repos, setRepos] = useState<GitRepo[]>([]);

  // Workspace step state
  const [workspaceName, setWorkspaceName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [showManualClone, setShowManualClone] = useState(false);

  const inputClass = "w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]";

  const handleAuthenticate = async () => {
    if (!token.trim()) return;
    setValidating(true);
    setAuthError('');

    const user = await fetchGitUserFromToken(token.trim());
    if (!user) {
      setAuthError(t('welcome.authFailed'));
      setValidating(false);
      return;
    }

    setUserInfo(user);

    // Fetch repo list in background
    const repoList = await fetchRepoList(token.trim());
    setRepos(repoList);
    setValidating(false);
    setStep('workspace');
  };

  const handleSkip = () => {
    setToken('');
    setUserInfo(null);
    setRepos([]);
    setStep('workspace');
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    const name = workspaceName.trim() || 'My Knowledge Base';
    onCreateWorkspace(name, token.trim() || undefined);
  };

  const handleCloneFromList = (repo: GitRepo) => {
    if (!onCloneRepo) return;
    onCloneRepo(repo.cloneUrl, repo.name, token.trim() || undefined);
  };

  const handleCloneManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl.trim() || !onCloneRepo) return;
    const name = workspaceName.trim() || cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';
    onCloneRepo(cloneUrl.trim(), name, token.trim() || undefined);
  };

  // ── Step 1: Authentication ──
  if (step === 'auth') {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-bg-main)]">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {t('welcome.title')}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {t('welcome.subtitle')}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
                {t('welcome.remoteAuth')}
              </h2>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('welcome.tokenLabel')}
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setAuthError(''); }}
                  placeholder={t('welcome.tokenPlaceholder')}
                  className={inputClass}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAuthenticate(); }}
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {t('welcome.tokenHint')}
                </p>
                {authError && (
                  <p className="text-xs text-[var(--color-danger)] mt-1">{authError}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleAuthenticate}
              disabled={!token.trim() || validating}
              className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? t('welcome.validating') : t('welcome.authenticateNext')}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2 rounded-md text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('welcome.skipToLocal')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Workspace Selection ──
  const authenticated = !!userInfo;

  return (
    <div className="flex items-center justify-center h-full bg-[var(--color-bg-main)] overflow-y-auto">
      <div className="w-full max-w-md p-8">
        {/* User greeting */}
        {authenticated && (
          <div className="mb-6 px-4 py-3 rounded-md bg-[var(--color-sidebar-selected)] border border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-primary)]">
              {t('welcome.authenticatedAs', { name: userInfo.name || userInfo.email })}
            </p>
          </div>
        )}

        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
          {t('welcome.selectWorkspace')}
        </h2>

        {/* Remote repos list (if authenticated) */}
        {authenticated && repos.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
              {t('welcome.remoteRepos')}
            </h3>
            <div className="border border-[var(--color-border)] rounded-md max-h-60 overflow-y-auto">
              {repos.map((repo) => (
                <button
                  key={repo.fullName}
                  onClick={() => handleCloneFromList(repo)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {repo.fullName}
                      </span>
                      {repo.isPrivate && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]">
                          private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 ml-2 text-xs text-[var(--color-accent)]">
                    Clone
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual clone URL */}
        {onCloneRepo && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowManualClone(!showManualClone)}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              {t('welcome.cloneByUrl')}
            </button>
            {showManualClone && (
              <form onSubmit={handleCloneManual} className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    {t('welcome.repoUrl')}
                  </label>
                  <input
                    type="text"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    {t('welcome.workspaceName')}
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder={cloneUrl.split('/').pop()?.replace('.git', '') || t('welcome.workspaceNamePlaceholder')}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!cloneUrl.trim()}
                  className="w-full py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('welcome.clone')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-xs text-[var(--color-text-secondary)]">{t('welcome.or')}</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Create new workspace */}
        <form onSubmit={handleCreateNew} className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            {t('welcome.createWorkspace')}
          </h3>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              {t('welcome.workspaceName')}
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder={t('welcome.workspaceNamePlaceholder')}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {t('welcome.start')}
          </button>
        </form>

        {/* Back to auth */}
        {!authenticated && (
          <button
            type="button"
            onClick={() => setStep('auth')}
            className="w-full mt-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {t('welcome.backToAuth')}
          </button>
        )}
      </div>
    </div>
  );
}
