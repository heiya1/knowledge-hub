import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Link, Terminal, GitBranch, Search, Keyboard, BookOpen, Slash } from 'lucide-react';

interface HelpPageProps {
  onBack: () => void;
}

export function HelpPage({ onBack }: HelpPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-main">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('help.back')}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {t('help.title')}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('help.description')}
            </p>
          </div>

          {/* Features */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('help.features')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                { icon: FileText, key: 'featurePages' },
                { icon: Link, key: 'featureWikiLink' },
                { icon: Slash, key: 'featureSlash' },
                { icon: GitBranch, key: 'featureGit' },
                { icon: Search, key: 'featureSearch' },
                { icon: Terminal, key: 'featureTerminal' },
                { icon: BookOpen, key: 'featureMermaid' },
                { icon: Keyboard, key: 'featureMath' },
              ] as const).map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-bg-sidebar border border-border">
                  <Icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {t(`help.${key}`)}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      {t(`help.${key}Desc`)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Shortcuts */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('titleBar.shortcuts')}
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-0">
              {([
                ['titleBar.shortcutSearch', 'Ctrl+K'],
                ['titleBar.shortcutNewPage', 'Ctrl+N'],
                ['titleBar.shortcutSave', 'Ctrl+S'],
                ['titleBar.shortcutCommit', 'Ctrl+Shift+S'],
                ['titleBar.shortcutPush', 'Ctrl+Shift+P'],
                ['titleBar.shortcutSidebar', 'Ctrl+\\'],
                ['titleBar.shortcutTerminal', 'Ctrl+`'],
              ] as const).map(([key, shortcut]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-text-primary">{t(key)}</span>
                  <kbd className="text-xs font-mono text-text-secondary bg-bg-sidebar px-2 py-0.5 rounded border border-border">
                    {shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              {t('help.tips')}
            </h2>
            <ul className="space-y-3">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <li key={n} className="flex items-start gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs font-medium shrink-0">
                    {n}
                  </span>
                  <span className="text-text-secondary pt-0.5">{t(`help.tip${n}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
