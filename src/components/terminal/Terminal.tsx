import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Plus, X, Columns2, PanelRight } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { Tooltip } from '../common/Tooltip';

/**
 * Try to import the PTY spawn function from tauri-pty.
 */
async function getPtySpawn(): Promise<typeof import('tauri-pty').spawn | null> {
  try {
    const mod = await import('tauri-pty');
    return mod.spawn;
  } catch {
    return null;
  }
}

/** Check if app is in dark mode */
function isAppDarkMode(): boolean {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return true;
  if (root.classList.contains('light')) return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** xterm.js theme that matches our CSS variables */
function getXtermTheme(dark: boolean): Record<string, string> {
  if (dark) {
    return {
      background: '#161a1d',
      foreground: '#b6c2cf',
      cursor: '#579dff',
      cursorAccent: '#161a1d',
      selectionBackground: '#1c2b41',
      selectionForeground: '#b6c2cf',
      black: '#161a1d',
      red: '#ff5630',
      green: '#36b37e',
      yellow: '#ffab00',
      blue: '#579dff',
      magenta: '#b07ce8',
      cyan: '#00b8d9',
      white: '#b6c2cf',
      brightBlack: '#2c333a',
      brightRed: '#ff7452',
      brightGreen: '#57d9a3',
      brightYellow: '#ffe380',
      brightBlue: '#85b8ff',
      brightMagenta: '#c9a0f5',
      brightCyan: '#4dd4e6',
      brightWhite: '#dfe1e6',
    };
  }
  return {
    background: '#f4f5f7',
    foreground: '#172b4d',
    cursor: '#0052cc',
    cursorAccent: '#f4f5f7',
    selectionBackground: '#e3f2fd',
    selectionForeground: '#172b4d',
    black: '#172b4d',
    red: '#de350b',
    green: '#00875a',
    yellow: '#ff991f',
    blue: '#0052cc',
    magenta: '#8777d9',
    cyan: '#00b8d9',
    white: '#f4f5f7',
    brightBlack: '#6b778c',
    brightRed: '#ff5630',
    brightGreen: '#36b37e',
    brightYellow: '#ffab00',
    brightBlue: '#0065ff',
    brightMagenta: '#998dd9',
    brightCyan: '#00c7e6',
    brightWhite: '#ffffff',
  };
}

interface TerminalProps {
  workspacePath: string;
}

interface TermInst {
  id: string;
  label: string;
  groupId: string;
}

let termCounter = 0;
let groupCounter = 0;

const MIN_HEIGHT = 100;
const DEFAULT_HEIGHT = 250;
const MAX_VH_RATIO = 0.5;

/* ---------- Single terminal instance ---------- */
function TerminalInstance({
  workspacePath,
  isActive,
  onFocus,
  ptySpawn,
}: {
  workspacePath: string;
  isActive: boolean;
  onFocus: () => void;
  ptySpawn: typeof import('tauri-pty').spawn;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm + PTY on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const dark = isAppDarkMode();
    const theme = getXtermTheme(dark);
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace",
      theme,
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    });

    // Match container background to xterm theme to avoid border gap
    containerRef.current.style.backgroundColor = theme.background;

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    setTimeout(() => fitAddon.fit(), 10);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Spawn PTY process
    const shell = 'bash';
    let pty: ReturnType<typeof ptySpawn>;
    try {
      pty = ptySpawn(shell, [], {
        cols: xterm.cols,
        rows: xterm.rows,
        cwd: workspacePath,
        env: { PROMPT_COMMAND: 'PS1="\\[\\033[32m\\]\\u\\[\\033[0m\\]:\\[\\033[36m\\]\\W\\[\\033[0m\\] $ "' },
      });
    } catch (err) {
      xterm.write(`\x1b[31mFailed to spawn PTY: ${String(err)}\x1b[0m\r\n`);
      return () => { xterm.dispose(); xtermRef.current = null; fitAddonRef.current = null; };
    }

    // PTY → xterm (output)
    // tauri-pty invoke returns data as number[] from Rust, convert to string
    const decoder = new TextDecoder();
    const dataDisposable = pty.onData((data: Uint8Array | number[]) => {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      xterm.write(decoder.decode(bytes, { stream: true }));
    });

    // xterm → PTY (input)
    const inputDisposable = xterm.onData((data: string) => {
      pty.write(data);
    });

    // Resize sync
    const resizeDisposable = xterm.onResize(({ cols, rows }) => {
      pty.resize(cols, rows);
    });

    // PTY exit
    const exitDisposable = pty.onExit(({ exitCode }) => {
      xterm.write(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
    });

    return () => {
      dataDisposable.dispose();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      exitDisposable.dispose();
      pty.kill();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [ptySpawn, workspacePath]);

  // Focus when active
  useEffect(() => {
    if (isActive) xtermRef.current?.focus();
  }, [isActive]);

  // Theme sync
  useEffect(() => {
    const update = () => {
      const theme = getXtermTheme(isAppDarkMode());
      if (xtermRef.current?.options) {
        xtermRef.current.options.theme = theme;
      }
      if (containerRef.current) {
        containerRef.current.style.backgroundColor = theme.background;
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => { observer.disconnect(); mq.removeEventListener('change', update); };
  }, []);

  // ResizeObserver for refitting
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="flex-1 min-w-0 overflow-hidden"
      onClick={onFocus}
    >
      <div ref={containerRef} className="h-full" />
    </div>
  );
}

/* ---------- Resizable split group ---------- */
function SplitTerminalGroup({
  items,
  activeId,
  workspacePath,
  ptySpawn,
  onSelect,
}: {
  items: TermInst[];
  activeId: string;
  workspacePath: string;
  ptySpawn: typeof import('tauri-pty').spawn;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store ratios as equal splits initially; keyed by sorted item ids
  const [ratios, setRatios] = useState<number[]>(() => items.map(() => 1 / items.length));
  const resizingIdx = useRef<number | null>(null);

  // Reset ratios when item count changes
  useEffect(() => {
    setRatios(items.map(() => 1 / items.length));
  }, [items.length]);

  const handleMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizingIdx.current = idx;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (resizingIdx.current === null || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const i = resizingIdx.current;

      setRatios(prev => {
        const next = [...prev];
        // Sum of ratios before the handle
        const sumBefore = next.slice(0, i).reduce((a, b) => a + b, 0);
        // Sum of the two panels being resized
        const sumPair = next[i] + next[i + 1];
        const minRatio = 0.1;
        const newLeft = Math.max(minRatio, Math.min(sumBefore + sumPair - minRatio, x)) - sumBefore;
        next[i] = newLeft;
        next[i + 1] = sumPair - newLeft;
        return next;
      });
    };

    const handleMouseUp = () => {
      resizingIdx.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (items.length === 1) {
    return (
      <TerminalInstance
        workspacePath={workspacePath}
        isActive={items[0].id === activeId}
        onFocus={() => onSelect(items[0].id)}
        ptySpawn={ptySpawn}
      />
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {items.map((inst, idx) => (
        <Fragment key={inst.id}>
          <div
            className="min-w-0 overflow-hidden"
            style={{ width: `${ratios[idx] * 100}%` }}
          >
            <TerminalInstance
              workspacePath={workspacePath}
              isActive={inst.id === activeId}
              onFocus={() => onSelect(inst.id)}
              ptySpawn={ptySpawn}
            />
          </div>
          {idx < items.length - 1 && (
            <div
              className="w-1 shrink-0 cursor-col-resize bg-content-border hover:bg-accent/50 active:bg-accent transition-colors"
              onMouseDown={(e) => handleMouseDown(idx, e)}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

/* ---------- Terminal Panel ---------- */
export function Terminal({ workspacePath }: TerminalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [instances, setInstances] = useState<TermInst[]>([]);
  const [activeId, setActiveId] = useState('');
  const [showList, setShowList] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const ptySpawnRef = useRef<typeof import('tauri-pty').spawn | null>(null);
  const resizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  // Derived state
  const activeInst = useMemo(() => instances.find(i => i.id === activeId), [instances, activeId]);
  const activeGroupId = activeInst?.groupId ?? '';
  const visibleInstances = useMemo(
    () => instances.filter(i => i.groupId === activeGroupId),
    [instances, activeGroupId]
  );
  // Grouped instances for the right panel
  const groupedInstances = useMemo(() => {
    const groups: { groupId: string; items: TermInst[] }[] = [];
    const seen = new Set<string>();
    for (const inst of instances) {
      if (!seen.has(inst.groupId)) {
        seen.add(inst.groupId);
        groups.push({ groupId: inst.groupId, items: instances.filter(i => i.groupId === inst.groupId) });
      }
    }
    return groups;
  }, [instances]);

  // Check availability on mount
  useEffect(() => {
    getPtySpawn().then(spawn => {
      ptySpawnRef.current = spawn;
      setIsAvailable(spawn !== null);
    });
  }, []);

  // Ensure at least one instance when opened
  useEffect(() => {
    if (isOpen && instances.length === 0) {
      const id = `term-${++termCounter}`;
      const gid = `group-${++groupCounter}`;
      setInstances([{ id, label: String(termCounter), groupId: gid }]);
      setActiveId(id);
    }
  }, [isOpen, instances.length]);

  // Keyboard shortcut: Ctrl+` and custom event: toggle-terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-terminal', handleToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-terminal', handleToggle);
    };
  }, []);

  // "+" → New terminal in a NEW group (no split)
  const addInstance = useCallback(() => {
    const id = `term-${++termCounter}`;
    const gid = `group-${++groupCounter}`;
    setInstances(prev => [...prev, { id, label: String(termCounter), groupId: gid }]);
    setActiveId(id);
  }, []);

  // "Split" → New terminal in the SAME group as active
  const splitInstance = useCallback(() => {
    const gid = activeGroupId || `group-${++groupCounter}`;
    const id = `term-${++termCounter}`;
    setInstances(prev => [...prev, { id, label: String(termCounter), groupId: gid }]);
    setActiveId(id);
  }, [activeGroupId]);

  const closeInstance = useCallback((instId: string) => {
    const inst = instances.find(i => i.id === instId);
    if (!inst) return;
    const next = instances.filter(i => i.id !== instId);
    if (next.length === 0) {
      setInstances([]);
      setActiveId('');
      setIsOpen(false);
      return;
    }
    setInstances(next);
    if (activeId === instId) {
      // Prefer same group, then fallback to last
      const sameGroup = next.filter(i => i.groupId === inst.groupId);
      setActiveId(sameGroup.length > 0 ? sameGroup[sameGroup.length - 1].id : next[next.length - 1].id);
    }
  }, [instances, activeId]);

  const selectInstance = useCallback((instId: string) => {
    setActiveId(instId);
  }, []);

  // Resize handle
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = height;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = resizeStartYRef.current - ev.clientY;
      const maxHeight = window.innerHeight * MAX_VH_RATIO;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, resizeStartHeightRef.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  if (!isOpen) return null;

  const actionBtnClass = 'flex items-center justify-center w-6 h-6 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors';

  return (
    <div
      className="flex flex-col border-t border-border bg-bg-main"
      style={{ height: `${height}px`, minHeight: `${MIN_HEIGHT}px`, maxHeight: '50vh' }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-row-resize hover:bg-accent transition-colors shrink-0"
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-orientation="horizontal"
      />

      {/* Header bar */}
      <div className="flex items-center px-2 py-0.5 text-xs bg-bg-main border-b border-border shrink-0">
        {/* Current group tabs */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {visibleInstances.map(inst => (
            <div
              key={inst.id}
              className={`group flex items-center gap-0.5 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
                inst.id === activeId
                  ? 'bg-bg-main text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
              onClick={() => selectInstance(inst.id)}
            >
              <span>{t('terminal.title')} {inst.label}</span>
              {visibleInstances.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); closeInstance(inst.id); }}
                  className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-border transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <Tooltip content={t('terminal.newTerminal')}>
            <button onClick={addInstance} className={actionBtnClass}>
              <Plus className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('terminal.splitTerminal')}>
            <button onClick={splitInstance} className={actionBtnClass}>
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('common.close')}>
            <button onClick={() => setIsOpen(false)} className={actionBtnClass}>
              <X className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <div className="w-px h-4 bg-border mx-0.5" />
          <Tooltip content={t('terminal.terminalList')}>
            <button
              onClick={() => setShowList(prev => !prev)}
              className={`${actionBtnClass} ${showList ? 'bg-bg-hover text-text-primary' : ''}`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Content: terminal area + optional right list */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Terminal instances area */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          {isAvailable === false && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary">
              {t('terminal.notAvailable')}
            </div>
          )}
          {isAvailable && ptySpawnRef.current && groupedInstances.map(group => {
            const isActiveGroup = group.groupId === activeGroupId;
            return (
              <div
                key={group.groupId}
                className={`absolute inset-0 ${isActiveGroup ? 'z-10' : 'z-0 pointer-events-none opacity-0'}`}
              >
                <SplitTerminalGroup
                  items={group.items}
                  activeId={activeId}
                  workspacePath={workspacePath}
                  ptySpawn={ptySpawnRef.current!}
                  onSelect={selectInstance}
                />
              </div>
            );
          })}
        </div>

        {/* Right panel: terminal list */}
        {showList && (
          <div className="w-44 shrink-0 border-l border-border bg-bg-main overflow-y-auto">
            {groupedInstances.map((group) => (
              <div key={group.groupId}>
                {group.items.map((inst, idx) => (
                  <div
                    key={inst.id}
                    onClick={() => selectInstance(inst.id)}
                    className={`group flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                      inst.id === activeId
                        ? 'bg-sidebar-selected text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    {group.items.length > 1 && (
                      <span className="text-[10px] text-text-secondary w-3 shrink-0">
                        {idx === 0 ? '┌' : idx === group.items.length - 1 ? '└' : '├'}
                      </span>
                    )}
                    <span className="flex-1 truncate">{t('terminal.title')} {inst.label}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); closeInstance(inst.id); }}
                      className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-border transition-all shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
