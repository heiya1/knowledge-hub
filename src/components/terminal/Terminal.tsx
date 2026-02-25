import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/**
 * Check if Tauri shell APIs are available.
 * Returns the Command class if available, null otherwise.
 */
async function getTauriShellCommand(): Promise<typeof import('@tauri-apps/plugin-shell').Command | null> {
  try {
    const mod = await import('@tauri-apps/plugin-shell');
    return mod.Command;
  } catch {
    return null;
  }
}

/** Detect the current OS-level theme (dark/light) */
function isDarkMode(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Check if explicitly dark class is present, or auto-dark via OS */
function isAppDarkMode(): boolean {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return true;
  if (root.classList.contains('light')) return false;
  return isDarkMode();
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

const MIN_HEIGHT = 100;
const DEFAULT_HEIGHT = 250;
const MAX_VH_RATIO = 0.5;

export function Terminal({ workspacePath }: TerminalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandBufferRef = useRef('');
  const cwdRef = useRef(workspacePath);
  const isRunningRef = useRef(false);
  const CommandRef = useRef<typeof import('@tauri-apps/plugin-shell').Command | null>(null);
  const resizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  // Update cwd when workspace path changes
  useEffect(() => {
    cwdRef.current = workspacePath;
  }, [workspacePath]);

  // Check availability on mount
  useEffect(() => {
    getTauriShellCommand().then((cmd) => {
      CommandRef.current = cmd;
      setIsAvailable(cmd !== null);
    });
  }, []);

  // Keyboard shortcut: Ctrl+`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /** Write a prompt line to the terminal */
  const writePrompt = useCallback(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    // Show a short directory name
    const dirName = cwdRef.current.split('/').pop() || cwdRef.current;
    xterm.write(`\r\n\x1b[36m${dirName}\x1b[0m $ `);
  }, []);

  /** Execute a command via Tauri shell plugin */
  const executeCommand = useCallback(async (command: string) => {
    const xterm = xtermRef.current;
    const Command = CommandRef.current;
    if (!xterm || !Command) return;

    const trimmed = command.trim();
    if (!trimmed) {
      writePrompt();
      return;
    }

    // Handle built-in "cd" command
    if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
      const parts = trimmed.split(/\s+/);
      const target = parts[1];
      if (!target || target === '~') {
        // cd with no argument or ~ : go to home
        try {
          const result = await Command.create('exec-sh', ['-c', 'echo $HOME']).execute();
          const home = result.stdout.trim();
          if (home) cwdRef.current = home;
        } catch {
          // fallback: stay in current dir
        }
      } else {
        // Resolve relative or absolute path
        let newPath: string;
        if (target.startsWith('/')) {
          newPath = target;
        } else {
          newPath = `${cwdRef.current}/${target}`;
        }
        // Normalize the path using shell
        try {
          const result = await Command.create('exec-sh', [
            '-c',
            `cd "${newPath}" && pwd`,
          ]).execute();
          const resolved = result.stdout.trim();
          if (resolved) {
            cwdRef.current = resolved;
          } else {
            // stderr likely has an error
            const errMsg = result.stderr.trim();
            if (errMsg) {
              xterm.write(`\r\n\x1b[31m${errMsg}\x1b[0m`);
            }
          }
        } catch (err) {
          xterm.write(`\r\n\x1b[31mcd: ${String(err)}\x1b[0m`);
        }
      }
      writePrompt();
      return;
    }

    // Handle "clear"
    if (trimmed === 'clear') {
      xterm.clear();
      xterm.write('\x1b[2J\x1b[H'); // clear screen + cursor home
      writePrompt();
      return;
    }

    isRunningRef.current = true;

    try {
      const result = await Command.create('exec-sh', [
        '-c',
        `cd "${cwdRef.current}" && ${trimmed}`,
      ]).execute();

      if (result.stdout) {
        // Process stdout, converting \n to \r\n for xterm
        const lines = result.stdout.replace(/\r?\n/g, '\r\n');
        xterm.write(`\r\n${lines}`);
      }

      if (result.stderr) {
        const lines = result.stderr.replace(/\r?\n/g, '\r\n');
        xterm.write(`\r\n\x1b[31m${lines}\x1b[0m`);
      }

      if (result.code !== 0 && result.code !== null) {
        xterm.write(`\r\n\x1b[33m(exit code: ${result.code})\x1b[0m`);
      }
    } catch (err) {
      xterm.write(`\r\n\x1b[31mError: ${String(err)}\x1b[0m`);
    }

    isRunningRef.current = false;
    writePrompt();
  }, [writePrompt]);

  // Initialize xterm.js when terminal is opened
  useEffect(() => {
    if (!isOpen || !termRef.current || isAvailable === null) return;

    // If xterm already exists, just refit
    if (xtermRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
      return;
    }

    const dark = isAppDarkMode();
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace",
      theme: getXtermTheme(dark),
      allowProposedApi: true,
      convertEol: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(termRef.current);

    // Small delay to let DOM settle before fitting
    setTimeout(() => fitAddon.fit(), 10);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    if (isAvailable) {
      // Print welcome banner
      const dirName = cwdRef.current.split('/').pop() || cwdRef.current;
      xterm.write(`\x1b[1m${t('terminal.title')}\x1b[0m - ${cwdRef.current}\r\n`);
      xterm.write(`\x1b[36m${dirName}\x1b[0m $ `);

      // Handle keyboard input
      xterm.onData((data) => {
        if (isRunningRef.current) return; // Ignore input while command is running

        for (const char of data) {
          if (char === '\r') {
            // Enter key: execute the command
            const cmd = commandBufferRef.current;
            commandBufferRef.current = '';
            executeCommand(cmd);
          } else if (char === '\x7f' || char === '\b') {
            // Backspace
            if (commandBufferRef.current.length > 0) {
              commandBufferRef.current = commandBufferRef.current.slice(0, -1);
              xterm.write('\b \b');
            }
          } else if (char === '\x03') {
            // Ctrl+C
            commandBufferRef.current = '';
            xterm.write('^C');
            writePrompt();
          } else if (char === '\x0c') {
            // Ctrl+L (clear screen)
            xterm.clear();
            xterm.write('\x1b[2J\x1b[H');
            writePrompt();
          } else if (char >= ' ') {
            // Printable character
            commandBufferRef.current += char;
            xterm.write(char);
          }
        }
      });
    } else {
      xterm.write(`\x1b[33m${t('terminal.notAvailable')}\x1b[0m\r\n`);
    }

    return () => {
      // Don't dispose on unmount if we're just toggling - only on full cleanup
    };
  }, [isOpen, isAvailable, executeCommand, writePrompt, t]);

  // Watch for theme changes and update xterm colors
  useEffect(() => {
    if (!xtermRef.current) return;

    const observer = new MutationObserver(() => {
      const dark = isAppDarkMode();
      xtermRef.current?.options && (xtermRef.current.options.theme = getXtermTheme(dark));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const dark = isAppDarkMode();
      if (xtermRef.current?.options) {
        xtermRef.current.options.theme = getXtermTheme(dark);
      }
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [isOpen]);

  // Refit on height or open state change
  useEffect(() => {
    if (isOpen && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0);
    }
  }, [isOpen, height]);

  // Refit on window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      fitAddonRef.current?.fit();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Resize handle mouse events
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

  return (
    <div
      className="flex flex-col border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)]"
      style={{ height: `${height}px`, minHeight: `${MIN_HEIGHT}px`, maxHeight: '50vh' }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-row-resize hover:bg-[var(--color-accent)] transition-colors flex-shrink-0"
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
      />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border)] flex-shrink-0">
        <span className="font-medium text-[var(--color-text-primary)]">
          {t('terminal.title')}
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:text-[var(--color-text-primary)] transition-colors px-1"
          title={t('common.close')}
        >
          &times;
        </button>
      </div>

      {/* Terminal content */}
      <div
        ref={termRef}
        className="flex-1 overflow-hidden"
        style={{ padding: '4px' }}
      />
    </div>
  );
}
