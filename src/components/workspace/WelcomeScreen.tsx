import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchGitUserFromToken, fetchRepoList } from '../../infrastructure/GitProviderApi';
import type { GitRepo, GitUserInfo } from '../../infrastructure/GitProviderApi';

type Step = 'loading' | 'auth' | 'workspace';
type WorkspaceMode = 'clone' | 'create';

interface WelcomeScreenProps {
  onCreateWorkspace: (repoName: string, workspaceName: string, token?: string) => void;
  onCloneRepo?: (url: string, name: string, token?: string) => void;
  onBack?: () => void;
  existingToken?: string;
}

export function WelcomeScreen({ onCreateWorkspace, onCloneRepo, onBack, existingToken }: WelcomeScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(existingToken ? 'loading' : 'auth');
  const [token, setToken] = useState(existingToken || '');
  const [validating, setValidating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [userInfo, setUserInfo] = useState<GitUserInfo | null>(null);
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const autoAuthDone = useRef(false);

  // Auto-authenticate if token already exists
  useEffect(() => {
    if (!existingToken || autoAuthDone.current) return;
    autoAuthDone.current = true;

    (async () => {
      const user = await fetchGitUserFromToken(existingToken);
      if (user) {
        setUserInfo(user);
        const repoList = await fetchRepoList(existingToken);
        setRepos(repoList);
        setMode(repoList.length > 0 ? 'clone' : 'create');
        setStep('workspace');
      } else {
        // Token invalid/expired, show auth screen
        setStep('auth');
      }
    })();
  }, [existingToken]);

  // Workspace step state
  const [mode, setMode] = useState<WorkspaceMode>('clone');
  const [repoName, setRepoName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [repoFilter, setRepoFilter] = useState('');

  const inputClass = "w-full px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary focus:outline-none focus:border-accent placeholder:text-text-secondary";

  const switchMode = (newMode: WorkspaceMode) => {
    setMode(newMode);
    setWorkspaceName('');
    setRepoName('');
    setCloneUrl('');
    setRepoFilter('');
  };

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

  // ── Loading: auto-auth in progress ──
  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-main">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">{t('welcome.loadingRepos')}</p>
        </div>
      </div>
    );
  }

  // ── Step 1: Authentication ──
  if (step === 'auth') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-main">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              {t('welcome.title')}
            </h1>
            <p className="text-text-secondary">
              {t('welcome.subtitle')}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-3">
                {t('welcome.remoteAuth')}
              </h2>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
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
                <p className="text-xs text-text-secondary mt-1">
                  {t('welcome.tokenHint')}
                </p>
                {authError && (
                  <p className="text-xs text-danger mt-1">{authError}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleAuthenticate}
              disabled={!token.trim() || validating}
              className="w-full py-2.5 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? t('welcome.validating') : t('welcome.authenticateNext')}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('welcome.skipToLocal')}
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Workspace Selection ──
  return (
    <div className="flex items-center justify-center h-full bg-bg-main overflow-y-auto">
      <div className="w-full max-w-md p-8">
        {/* User greeting */}
        {authenticated && (
          <div className="mb-5 px-4 py-3 rounded-md bg-sidebar-selected border border-border">
            <p className="text-sm text-text-primary">
              {t('welcome.authenticatedAs', { name: userInfo.name || userInfo.email })}
            </p>
          </div>
        )}

        {/* Tab switcher (only show clone tab when authenticated) */}
        {authenticated ? (
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => switchMode('clone')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-colors ${
                mode === 'clone'
                  ? 'border-accent bg-sidebar-selected text-accent'
                  : 'border-border text-text-primary hover:bg-bg-hover'
              }`}
            >
              {t('welcome.cloneExisting')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('create')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-colors ${
                mode === 'create'
                  ? 'border-accent bg-sidebar-selected text-accent'
                  : 'border-border text-text-primary hover:bg-bg-hover'
              }`}
            >
              {t('welcome.createNew')}
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-text-primary mb-5">
            {t('welcome.createWorkspace')}
          </h2>
        )}

        {/* Clone mode */}
        {mode === 'clone' && (
          <div className="space-y-4">
            {/* Repo list from API */}
            {authenticated && repos.length > 0 && (() => {
              const q = repoFilter.toLowerCase();
              const filteredRepos = q
                ? repos.filter(r =>
                    r.fullName.toLowerCase().includes(q) ||
                    (r.description?.toLowerCase().includes(q))
                  )
                : repos;
              return (
                <div>
                  <input
                    type="text"
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                    placeholder={t('welcome.repoFilterPlaceholder', 'Filter repositories...')}
                    className={`${inputClass} mb-2`}
                  />
                  <div className="border border-border rounded-md max-h-64 overflow-y-auto">
                    {filteredRepos.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-text-secondary">
                        {t('welcome.noReposMatch', 'No matching repositories')}
                      </div>
                    ) : (
                      filteredRepos.map((repo) => {
                        const selected = cloneUrl === repo.cloneUrl;
                        return (
                          <button
                            key={repo.fullName}
                            onClick={() => handleSelectRepo(repo)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors border-b border-border last:border-b-0 ${
                              selected
                                ? 'bg-sidebar-selected'
                                : 'hover:bg-bg-hover'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">
                                  {repo.fullName}
                                </span>
                                {repo.isPrivate && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary">
                                    private
                                  </span>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-text-secondary truncate mt-0.5">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <span className="shrink-0 ml-2 text-xs text-accent font-medium">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Clone form (filled by repo selection or manual input) */}
            <form onSubmit={handleCloneManual} className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
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
                <label className="block text-sm text-text-secondary mb-1">
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
                className="w-full py-2.5 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <label className="block text-sm text-text-secondary mb-1">
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
                <label className="block text-sm text-text-secondary">
                  {t('welcome.workspaceName')}
                </label>
                {repoName.trim() && repoName.trim() !== workspaceName && (
                  <button
                    type="button"
                    onClick={() => setWorkspaceName(repoName.trim())}
                    className="text-xs text-accent hover:underline"
                  >
                    {t('welcome.copyFromRepo')}
                  </button>
                )}
              </div>
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
              disabled={!repoName.trim()}
              className="w-full py-2.5 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('welcome.start')}
            </button>
          </form>
        )}

        {/* Back to auth */}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={() => setStep('auth')}
            className="flex-1 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {authenticated ? t('welcome.changeAccount') : t('welcome.backToAuth')}
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
