import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Copy, Search, CircleHelp, Keyboard } from 'lucide-react';
import { useSearchStore } from '../../stores/searchStore';
import { Tooltip } from '../common/Tooltip';
import { isTauri } from '../../infrastructure/platform';

/** Lazily cached dynamic import of @tauri-apps/api/window */
type TauriWindowModule = typeof import('@tauri-apps/api/window');
let windowModulePromise: Promise<TauriWindowModule> | null = null;
function getTauriWindowModule(): Promise<TauriWindowModule> {
  if (!windowModulePromise) {
    windowModulePromise = import('@tauri-apps/api/window');
  }
  return windowModulePromise;
}

interface TitleBarProps {
  onOpenHelp?: () => void;
  /** Hide search bar, shortcuts, help — show only window controls */
  minimal?: boolean;
}

export function TitleBar({ onOpenHelp, minimal }: TitleBarProps) {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const setSearchOpen = useSearchStore((s) => s.setOpen);
  const inTauri = isTauri();

  useEffect(() => {
    if (!inTauri) return;
    let cancelled = false;
    getTauriWindowModule().then(({ getCurrentWindow }) => {
      if (cancelled) return;
      const appWindow = getCurrentWindow();
      appWindow.isMaximized().then(setMaximized);
      const unlisten = appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      });
      return () => { unlisten.then((fn) => fn()); };
    });
    return () => { cancelled = true; };
  }, [inTauri]);

  const handleMinimize = useCallback(() => {
    if (!inTauri) return;
    getTauriWindowModule().then(({ getCurrentWindow }) => getCurrentWindow().minimize());
  }, [inTauri]);
  const handleMaximize = useCallback(() => {
    if (!inTauri) return;
    getTauriWindowModule().then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize());
  }, [inTauri]);
  const handleClose = useCallback(() => {
    if (!inTauri) return;
    getTauriWindowModule().then(({ getCurrentWindow }) => getCurrentWindow().close());
  }, [inTauri]);

  // Close popup on outside click
  useEffect(() => {
    if (!shortcutsOpen) return;
    const handle = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-shortcuts-popup]')) {
        setShortcutsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [shortcutsOpen]);

  return (
    <div
      className="flex items-center h-9 bg-bg-titlebar border-b border-sidebar-border select-none shrink-0"
      data-tauri-drag-region
      onDoubleClick={handleMaximize}
    >
      {/* Center: Search bar (hidden in minimal mode) */}
      {!minimal && (
        <div className="flex-1 flex items-center justify-center h-full min-w-0 px-4" data-tauri-drag-region>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 h-6 px-3 w-full max-w-[360px] rounded-md bg-white/90 border border-sidebar-border text-text-secondary hover:bg-white transition-colors text-xs cursor-pointer"
          >
            <Search className="w-3 h-3 shrink-0" />
            <span className="truncate">{t('sidebar.searchPlaceholder')}</span>
          </button>
        </div>
      )}
      {minimal && <div className="flex-1" data-tauri-drag-region />}

      {/* Right: Shortcuts + Help + Window controls */}
      <div className="flex items-center h-full shrink-0">
        {!minimal && (
          <>
            {/* Shortcuts */}
            <div className="relative" data-shortcuts-popup>
              <Tooltip content={t('titleBar.shortcuts')}>
                <button
                  onClick={() => setShortcutsOpen((v) => !v)}
                  className={`h-9 w-9 flex items-center justify-center transition-colors ${
                    shortcutsOpen
                      ? 'text-sidebar-accent bg-sidebar-hover'
                      : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                  }`}
                  tabIndex={-1}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              {shortcutsOpen && (
                <div className="absolute right-0 top-9 w-56 bg-bg-main border border-border rounded-lg shadow-lg z-50 py-1 text-xs">
                  <div className="px-3 py-1.5 text-text-secondary border-b border-border font-medium">
                    {t('titleBar.shortcuts')}
                  </div>
                  {([
                    ['titleBar.shortcutSearch', 'Ctrl+K'],
                    ['titleBar.shortcutNewPage', 'Ctrl+N'],
                    ['titleBar.shortcutSave', 'Ctrl+S'],
                    ['titleBar.shortcutCommit', 'Ctrl+Shift+S'],
                    ['titleBar.shortcutPush', 'Ctrl+Shift+P'],
                    ['titleBar.shortcutSidebar', 'Ctrl+\\'],
                    ['titleBar.shortcutTerminal', 'Ctrl+`'],
                  ] as const).map(([key, shortcut]) => (
                    <div key={key} className="px-3 py-1 flex justify-between text-text-primary">
                      <span>{t(key)}</span>
                      <kbd className="text-text-secondary font-mono">{shortcut}</kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Help */}
            <Tooltip content={t('help.title')}>
              <button
                onClick={() => { setShortcutsOpen(false); onOpenHelp?.(); }}
                className="h-9 w-9 flex items-center justify-center text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors"
                tabIndex={-1}
              >
                <CircleHelp className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {/* Separator */}
            <div className="w-px h-4 bg-sidebar-border mx-0.5" />
          </>
        )}

        {/* Window controls */}
        <button onClick={handleMinimize} className="h-9 w-11 flex items-center justify-center text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors" tabIndex={-1}>
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleMaximize} className="h-9 w-11 flex items-center justify-center text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text transition-colors" tabIndex={-1}>
          {maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>
        <button onClick={handleClose} className="h-9 w-11 flex items-center justify-center text-sidebar-text-muted hover:bg-red-600 hover:text-white transition-colors" tabIndex={-1}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
