import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { ThemeMode, Language, SyncInterval } from '../../stores/settingsStore';

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { t, i18n } = useTranslation();
  const {
    theme, language, gitAuthorName, gitAuthorEmail,
    autoSave, fontSize, gitToken, autoSync, syncInterval,
    setTheme, setLanguage, setGitAuthor, setAutoSave, setFontSize,
    setGitToken, setAutoSync, setSyncInterval,
  } = useSettingsStore();
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    document.documentElement.classList.remove('light', 'dark');
    if (newTheme !== 'auto') {
      document.documentElement.classList.add(newTheme);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    if (newLang !== 'auto') {
      i18n.changeLanguage(newLang);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-[var(--color-bg-main)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {/* General */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t('settings.general')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-text-primary)] mb-1.5">
                  {t('settings.theme')}
                </label>
                <div className="flex gap-2">
                  {(['auto', 'light', 'dark'] as ThemeMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleThemeChange(m)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        theme === m
                          ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                      }`}
                    >
                      {t(`settings.theme${m.charAt(0).toUpperCase() + m.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-primary)] mb-1.5">
                  {t('settings.language')}
                </label>
                <div className="flex gap-2">
                  {(['auto', 'ja', 'en'] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLanguageChange(l)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        language === l
                          ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                      }`}
                    >
                      {t(`settings.lang${l.charAt(0).toUpperCase() + l.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* User */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t('settings.user')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('welcome.name')}
                </label>
                <input
                  type="text"
                  value={gitAuthorName}
                  onChange={(e) => setGitAuthor(e.target.value, gitAuthorEmail)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('welcome.email')}
                </label>
                <input
                  type="email"
                  value={gitAuthorEmail}
                  onChange={(e) => setGitAuthor(gitAuthorName, e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>
          </section>

          {/* Editor */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t('settings.editor')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text-primary)]">
                  {t('settings.autoSave')}
                </label>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    autoSave ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoSave ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-primary)] mb-1.5">
                  {t('settings.fontSize')}: {fontSize}px
                </label>
                <input
                  type="range"
                  min={12}
                  max={24}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* Workspace */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t('settings.workspace')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('settings.workspacePath')}
                </label>
                <input
                  type="text"
                  value={activeWorkspace?.path ?? ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] text-sm cursor-default"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('settings.remoteUrl')}
                </label>
                <input
                  type="text"
                  value={activeWorkspace?.remoteUrl ?? ''}
                  onChange={(e) => {
                    if (activeWorkspace) {
                      updateWorkspace(activeWorkspace.id, { remoteUrl: e.target.value });
                    }
                  }}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
            </div>
          </section>

          {/* Git */}
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t('settings.git')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  {t('settings.gitToken')}
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder={t('settings.gitTokenPlaceholder')}
                  className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {t('settings.gitTokenHint')}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text-primary)]">
                  {t('settings.autoSync')}
                </label>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    autoSync ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      autoSync ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-primary)] mb-1.5">
                  {t('settings.syncInterval')}
                </label>
                <div className="flex gap-2">
                  {([15, 30, 60, 120] as SyncInterval[]).map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setSyncInterval(interval)}
                      disabled={!autoSync}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        syncInterval === interval
                          ? 'border-[var(--color-accent)] bg-[var(--color-sidebar-selected)] text-[var(--color-accent)]'
                          : autoSync
                            ? 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {t('settings.syncIntervalSeconds', { seconds: interval })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
