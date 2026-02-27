import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { ThemeMode, Language, SyncInterval } from '../../stores/settingsStore';

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
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
    <div className="flex-1 flex flex-col min-h-0 bg-bg-main">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('settings.back')}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {t('settings.title')}
            </h1>
          </div>

          {/* General */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('settings.general')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-primary mb-1.5">
                  {t('settings.theme')}
                </label>
                <div className="flex gap-2">
                  {(['auto', 'light', 'dark'] as ThemeMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleThemeChange(m)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        theme === m
                          ? 'border-accent bg-sidebar-selected text-accent'
                          : 'border-border text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      {t(`settings.theme${m.charAt(0).toUpperCase() + m.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-primary mb-1.5">
                  {t('settings.language')}
                </label>
                <div className="flex gap-2">
                  {(['auto', 'ja', 'en'] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLanguageChange(l)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        language === l
                          ? 'border-accent bg-sidebar-selected text-accent'
                          : 'border-border text-text-primary hover:bg-bg-hover'
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
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('settings.user')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {t('welcome.name')}
                </label>
                <input
                  type="text"
                  value={gitAuthorName}
                  onChange={(e) => setGitAuthor(e.target.value, gitAuthorEmail)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {t('welcome.email')}
                </label>
                <input
                  type="email"
                  value={gitAuthorEmail}
                  onChange={(e) => setGitAuthor(gitAuthorName, e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </section>

          {/* Editor */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('settings.editor')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-primary">
                  {t('settings.autoSave')}
                </label>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    autoSave ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      autoSave ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-text-primary mb-1.5">
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
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('settings.workspace')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {t('settings.workspacePath')}
                </label>
                <input
                  type="text"
                  value={activeWorkspace?.path ?? ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-md border border-border bg-bg-hover text-text-secondary text-sm cursor-default"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">
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
                  className="w-full px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </section>

          {/* Git */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('settings.git')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  {t('settings.gitToken')}
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder={t('settings.gitTokenPlaceholder')}
                  className="w-full px-3 py-2 rounded-md border border-border bg-bg-main text-text-primary text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-text-secondary mt-1">
                  {t('settings.gitTokenHint')}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm text-text-primary">
                  {t('settings.autoSync')}
                </label>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    autoSync ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      autoSync ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm text-text-primary mb-1.5">
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
                          ? 'border-accent bg-sidebar-selected text-accent'
                          : autoSync
                            ? 'border-border text-text-primary hover:bg-bg-hover'
                            : 'border-border text-text-secondary opacity-50 cursor-not-allowed'
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
