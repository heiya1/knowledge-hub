import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitUserFromToken, fetchRepoList } from '../../infrastructure/GitProviderApi';
import type { GitRepo, GitUserInfo } from '../../infrastructure/GitProviderApi';

type Step = 'auth' | 'workspace';
type WorkspaceMode = 'clone' | 'create';

interface WelcomeScreenProps {
  onCreateWorkspace: (repoName: string, workspaceName: string, token?: string) => void;
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
  const [mode, setMode] = useState<WorkspaceMode>('clone');
  const [repoName, setRepoName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');

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

    const repoList = await fetchRepoList(token.trim());
    setRepos(repoList);
    setValidating(false);
    setMode(repoList.length > 0 ? 'clone' : 'create');
    setStep('workspace');
  };

  const handleSkip = () => {
    setToken('');
    setUserInfo(null);
    setRepos([]);
    setMode('create');
    setStep('workspace');
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    const repo = repoName.trim();
    const display = workspaceName.trim() || repo;
    onCreateWorkspace(repo, display, token.trim() || undefined);
  };

  const handleSelectRepo = (repo: GitRepo) => {
    setCloneUrl(repo.cloneUrl);
    setWorkspaceName(repo.name);
  };

  const handleCloneManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl.trim() || !onCloneRepo) return;
    const name = workspaceName.trim() || cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';
    onCloneRepo(cloneUrl.trim(), name, token.trim() || undefined);
  };

  const authenticated = !!userInfo;

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
  return (
    <div className="flex items-center justify-center h-full bg-[var(--color-bg-main)] overflow-y-auto">
      <div className="w-full max-w-md p-8">
        {/* User greeting */}
        {authenticated && (
          <div className="mb-5 px-4 py-3 rounded-md bg-[var(--color-sidebar-selected)] border border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-primary)]">
              {t('welcome.authenticatedAs', { name: userInfo.name || userInfo.email })}
            </p>
          </div>
        )}

        {/* Tab switcher (only show clone tab when authenticated) */}
        {authenticated ? (
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode('clone')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-colors ${
                mode === 'clone'
                  ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {t('welcome.cloneExisting')}
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-colors ${
                mode === 'create'
                  ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {t('welcome.createNew')}
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-5">
            {t('welcome.createWorkspace')}
          </h2>
        )}

        {/* Clone mode */}
        {mode === 'clone' && (
          <div className="space-y-4">
            {/* Repo list from API */}
            {authenticated && repos.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-md max-h-64 overflow-y-auto">
                {repos.map((repo) => {
                  const selected = cloneUrl === repo.cloneUrl;
                  return (
                    <button
                      key={repo.fullName}
                      onClick={() => handleSelectRepo(repo)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors border-b border-[var(--color-border)] last:border-b-0 ${
                        selected
                          ? 'bg-[var(--color-sidebar-selected)]'
                          : 'hover:bg-[var(--color-bg-hover)]'
                      }`}
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
                      {selected && (
                        <span className="shrink-0 ml-2 text-xs text-[var(--color-accent)] font-medium">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Clone form (filled by repo selection or manual input) */}
            <form onSubmit={handleCloneManual} className="space-y-3">
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
                className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('welcome.clone')}
              </button>
            </form>
          </div>
        )}

        {/* Create mode */}
        {mode === 'create' && (
          <form onSubmit={handleCreateNew} className="space-y-3">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                {t('welcome.repoName')}
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder={t('welcome.repoNamePlaceholder')}
                className={inputClass}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-[var(--color-text-secondary)]">
                  {t('welcome.workspaceName')}
                </label>
                {repoName.trim() && repoName.trim() !== workspaceName && (
                  <button
                    type="button"
                    onClick={() => setWorkspaceName(repoName.trim())}
                    className="text-xs text-[var(--color-accent)] hover:underline"
                  >
                    {t('welcome.copyFromRepo')}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={repoName.trim() || t('welcome.workspaceNamePlaceholder')}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={!repoName.trim()}
              className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('welcome.start')}
            </button>
          </form>
        )}

        {/* Back to auth */}
        <button
          type="button"
          onClick={() => setStep('auth')}
          className="w-full mt-5 py-2 rounded-md text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {authenticated ? t('welcome.changeAccount') : t('welcome.backToAuth')}
        </button>
      </div>
    </div>
  );
}
