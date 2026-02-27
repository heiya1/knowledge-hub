import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { generateId } from '../../core/utils/id';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useSettingsStore } from '../../stores/settingsStore';

/** Check if the app is currently in dark mode */
function isDarkMode(theme: 'auto' | 'light' | 'dark'): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return document.documentElement.classList.contains('dark')
    || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
}

interface DrawioEditDetail {
  src: string;
  diagramFile: string;
  pos: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
}

interface DrawioEditorState {
  detail: DrawioEditDetail;
  diagramId: string;
  /** If the source is a PNG with embedded XML, store its data URL for xmlpng loading */
  pngDataUrl?: string;
}

const EMPTY_DRAWIO_XML = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

export function DrawioEditorOverlay() {
  const { t } = useTranslation();
  const [state, setState] = useState<DrawioEditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const xmlRef = useRef<string>('');
  const initSentRef = useRef(false);
  const closingRef = useRef(false);
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspacePath = activeWorkspace?.path ?? '';
  const currentDocumentId = useDocumentStore((s) => s.currentDocumentId);
  const theme = useSettingsStore((s) => s.theme);
  const dark = isDarkMode(theme);

  const close = useCallback(() => {
    closingRef.current = true;
    // Tell draw.io to exit cleanly so it stops sending events
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ action: 'exit' }),
        '*'
      );
    }
    setState(null);
    setLoading(true);
    setError(null);
    initSentRef.current = false;
  }, []);

  // Listen for drawio-edit custom events
  useEffect(() => {
    const handleDrawioEdit = async (e: Event) => {
      const detail = (e as CustomEvent<DrawioEditDetail>).detail;

      // Determine diagram ID: extract from existing diagramFile or generate new
      let diagramId = '';
      let pngDataUrl: string | undefined;

      if (detail.diagramFile) {
        // e.g. "assets/diagrams/abc123.drawio" -> "abc123"
        const match = detail.diagramFile.match(/\/([^/]+)\.drawio$/);
        diagramId = match ? match[1] : generateId();

        // Compute document directory for resolving ./ relative paths
        const docId = currentDocumentId ?? '';
        const lastSlash = docId.lastIndexOf('/');
        const docDir = lastSlash === -1 ? '' : docId.substring(0, lastSlash + 1);

        /** Resolve a potentially document-relative path to an absolute FS path */
        const resolveToAbsolute = (relPath: string) => {
          const sep = workspacePath.includes('\\') ? '\\' : '/';
          if (relPath.startsWith('./') || relPath.startsWith('../')) {
            const cleaned = relPath.replace(/^\.\//, '');
            return `${workspacePath}${sep}${docDir}${cleaned}`.replace(/\//g, sep);
          }
          return `${workspacePath}${sep}${relPath}`.replace(/\//g, sep);
        };

        // Try to load existing .drawio XML source
        try {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const fullPath = resolveToAbsolute(detail.diagramFile);
          const xml = await readTextFile(fullPath);
          xmlRef.current = xml;
        } catch {
          // .drawio XML not found — try loading the image file instead.
          // draw.io PNG/SVG exports can contain embedded XML data.
          xmlRef.current = '';

          if (detail.src) {
            try {
              const { readFile } = await import('@tauri-apps/plugin-fs');
              const imgPath = resolveToAbsolute(detail.src);

              if (detail.src.match(/\.drawio\.svg$/i)) {
                // SVG: read as text — draw.io SVGs contain embedded XML
                const { readTextFile } = await import('@tauri-apps/plugin-fs');
                const svgText = await readTextFile(imgPath);
                xmlRef.current = svgText;
              } else {
                // PNG/other: read as binary, convert to data URL for xmlpng
                const bytes = await readFile(imgPath);
                const base64 = btoa(
                  Array.from(new Uint8Array(bytes)).map((b) => String.fromCharCode(b)).join('')
                );
                const ext = detail.src.match(/\.(png|jpg|jpeg|webp)$/i)?.[1]?.toLowerCase() || 'png';
                const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
                pngDataUrl = `data:${mime};base64,${base64}`;
              }
            } catch {
              // Image file not readable
            }
          }
        }
      } else {
        diagramId = generateId();
        xmlRef.current = '';
      }

      closingRef.current = false;
      setLoading(true);
      setError(null);
      initSentRef.current = false;
      setState({ detail, diagramId, pngDataUrl });
    };

    window.addEventListener('drawio-edit', handleDrawioEdit);
    return () => window.removeEventListener('drawio-edit', handleDrawioEdit);
  }, [workspacePath, currentDocumentId]);

  // Handle postMessage from embed.diagrams.net iframe
  useEffect(() => {
    if (!state) return;

    const handleMessage = async (e: MessageEvent) => {
      let msg;
      try {
        msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }

      // Only process draw.io messages (they have an 'event' field)
      if (!msg || !msg.event) return;

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      switch (msg.event) {
        case 'configure': {
          break;
        }

        case 'init': {
          // Editor ready: load the diagram
          setLoading(false);
          initSentRef.current = true;

          if (state.pngDataUrl) {
            // Load PNG with embedded XML via xmlpng
            iframe.contentWindow.postMessage(
              JSON.stringify({ action: 'load', xmlpng: state.pngDataUrl }),
              '*'
            );
          } else {
            const xml = xmlRef.current || EMPTY_DRAWIO_XML;
            iframe.contentWindow.postMessage(
              JSON.stringify({ action: 'load', xml }),
              '*'
            );
          }
          break;
        }

        case 'load': {
          break;
        }

        case 'save': {
          // Ignore save events if the user is closing/canceling
          if (closingRef.current) break;
          // User clicked save: store XML and request SVG export
          xmlRef.current = msg.xml;
          iframe.contentWindow.postMessage(
            JSON.stringify({ action: 'export', format: 'svg' }),
            '*'
          );
          break;
        }

        case 'export': {
          // Ignore export events if the user is closing/canceling
          if (closingRef.current) break;
          // SVG export received: save files and update node
          try {
            await saveDiagramFiles(msg.data, xmlRef.current, state.diagramId);

            // Update TipTap node attributes
            const { detail } = state;
            const relativeSvgPath = `assets/diagrams/${state.diagramId}.drawio.svg`;
            const relativeDiagramPath = `assets/diagrams/${state.diagramId}.drawio`;

            detail.editor
              .chain()
              .focus()
              .command(({ tr }: { tr: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                // Preserve existing attributes (width, border, etc.)
                const existingAttrs = tr.doc.nodeAt(detail.pos)?.attrs || {};
                tr.setNodeMarkup(detail.pos, undefined, {
                  ...existingAttrs,
                  src: relativeSvgPath,
                  diagramFile: relativeDiagramPath,
                });
                return true;
              })
              .run();

            // Tell iframe to exit
            iframe.contentWindow?.postMessage(
              JSON.stringify({ action: 'exit' }),
              '*'
            );
            close();
          } catch (err) {
            console.error('[drawio] Save failed:', err);
            setError(String(err));
          }
          break;
        }

        case 'exit': {
          close();
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state, close, t]);

  // Save .drawio XML and .drawio.svg files to workspace
  const saveDiagramFiles = async (svgData: string, xml: string, diagramId: string) => {
    try {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const sep = workspacePath.includes('\\') ? '\\' : '/';
      const diagramsDir = `${workspacePath}${sep}assets${sep}diagrams`;

      // Ensure directory exists
      const dirExists = await exists(diagramsDir);
      if (!dirExists) {
        await mkdir(diagramsDir, { recursive: true });
      }

      const xmlPath = `${diagramsDir}${sep}${diagramId}.drawio`;
      const svgPath = `${diagramsDir}${sep}${diagramId}.drawio.svg`;

      // SVG data from export might be a data URI or raw SVG
      let svgContent = svgData;
      if (svgData.startsWith('data:image/svg+xml;base64,')) {
        svgContent = atob(svgData.replace('data:image/svg+xml;base64,', ''));
      }

      await writeTextFile(xmlPath, xml);
      await writeTextFile(svgPath, svgContent);
    } catch (err) {
      // Tauri FS not available - log and rethrow
      console.error('[drawio] Tauri FS not available:', err);
      throw err;
    }
  };

  if (!state) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          close();
        }
      }}
    >
      {/* Top bar with close button */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-main/90 border-b border-border shrink-0">
        <span className="text-sm font-medium text-text-primary">draw.io</span>
        <button
          onClick={close}
          className="px-3 py-1 text-sm rounded bg-bg-hover text-text-primary hover:bg-danger hover:text-white transition-colors"
        >
          {t('common.close', 'Close')}
        </button>
      </div>

      {/* iframe area */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-main z-10">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-text-secondary">
                {t('editor.slashCommand.drawioLoading', 'Loading draw.io editor...')}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-main z-10">
            <div className="text-center space-y-3 max-w-md">
              <p className="text-sm text-danger">{error}</p>
              <button
                onClick={close}
                className="px-4 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1${dark ? '&ui=dark' : ''}`}
          className="absolute inset-0 w-full h-full border-0"
          title="draw.io editor"
          onLoad={() => {
            // iframe loaded, but draw.io init message might not have arrived yet
            // Set a timeout to detect if draw.io never sends init
            setTimeout(() => {
              if (!initSentRef.current) {
                setLoading(false);
                setError(t('editor.slashCommand.drawioLoadFailed', 'Failed to load draw.io editor. Check your internet connection.'));
              }
            }, 15000);
          }}
          onError={() => {
            setLoading(false);
            setError(t('editor.slashCommand.drawioLoadFailed', 'Failed to load draw.io editor. Check your internet connection.'));
          }}
        />
      </div>
    </div>
  );
}
