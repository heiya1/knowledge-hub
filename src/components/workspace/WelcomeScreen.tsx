import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WelcomeScreenProps {
  onCreateWorkspace: (name: string, authorName: string, authorEmail: string) => void;
  onCloneRepo?: (url: string, name: string, authorName: string, authorEmail: string) => void;
}

export function WelcomeScreen({ onCreateWorkspace, onCloneRepo }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [showClone, setShowClone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showClone && cloneUrl.trim() && onCloneRepo) {
      const name = workspaceName.trim() || cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';
      onCloneRepo(cloneUrl.trim(), name, authorName, authorEmail);
    } else {
      const name = workspaceName.trim() || 'My Knowledge Base';
      onCreateWorkspace(name, authorName, authorEmail);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]";

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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
              {t('welcome.gitAuthor')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('welcome.name')}
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={t('welcome.namePlaceholder')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('welcome.email')}
                </label>
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder={t('welcome.emailPlaceholder')}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Tab: Create or Clone */}
          <div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setShowClone(false)}
                className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                  !showClone
                    ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {t('welcome.createWorkspace')}
              </button>
              {onCloneRepo && (
                <button
                  type="button"
                  onClick={() => setShowClone(true)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                    showClone
                      ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                  }`}
                >
                  {t('welcome.cloneRepo')}
                </button>
              )}
            </div>

            {showClone ? (
              <div className="space-y-3">
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
              </div>
            ) : (
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
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {showClone ? t('welcome.clone') : t('welcome.start')}
          </button>

          <button
            type="button"
            onClick={() => onCreateWorkspace('My Knowledge Base', '', '')}
            className="w-full py-2 rounded-md text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            {t('welcome.skipToLocal')}
          </button>
        </form>
      </div>
    </div>
  );
}
