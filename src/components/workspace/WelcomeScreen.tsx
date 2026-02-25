import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WelcomeScreenProps {
  onCreateWorkspace: (name: string, authorName: string, authorEmail: string) => void;
}

export function WelcomeScreen({ onCreateWorkspace }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = workspaceName.trim() || 'My Knowledge Base';
    onCreateWorkspace(name, authorName, authorEmail);
  };

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
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]"
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
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
              {t('welcome.createWorkspace')}
            </h2>
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                {t('welcome.workspaceName')}
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={t('welcome.workspaceNamePlaceholder')}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-md bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {t('welcome.start')}
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
