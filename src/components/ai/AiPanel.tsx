import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiStore } from '../../stores/aiStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { AiService } from '../../core/services/AiService';
import type { AiChatMessage } from '../../stores/aiStore';
import { getContainer } from '../../infrastructure/container';

const MIN_WIDTH = 240;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 320;

/** Simple markdown-like formatting for assistant messages */
function formatContent(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (``` ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre class="ai-code-block"><code>${code}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br />');

  return html;
}

function MessageBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div
          className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--color-accent)] text-white"
          style={{ wordBreak: 'break-word' }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-3">
      <div
        className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--color-bg-sidebar)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
        style={{ wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
      />
    </div>
  );
}

export function AiPanel() {
  const { t } = useTranslation();
  const {
    messages,
    isGenerating,
    panelOpen,
    setPanelOpen,
    addMessage,
    appendToLastMessage,
    setGenerating,
    setAbortController,
    abortController,
    clearMessages,
    pendingAction,
    setPendingAction,
  } = useAiStore();

  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const documents = useDocumentStore((s) => s.documents);

  const { aiProvider, aiApiKey, ollamaModel, ollamaUrl } = useSettingsStore();

  const [input, setInput] = useState('');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isResizing = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keyboard shortcut: Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setPanelOpen(!panelOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen, setPanelOpen]);

  // Resize handle
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = width;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;
        // Dragging left increases width (panel is on the right)
        const delta = resizeStartXRef.current - ev.clientX;
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidthRef.current + delta));
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width]
  );

  const createAiService = useCallback(() => {
    return new AiService({
      provider: aiProvider,
      apiKey: aiApiKey,
      ollamaModel,
      ollamaUrl,
    });
  }, [aiProvider, aiApiKey, ollamaModel, ollamaUrl]);

  const sendMessage = useCallback(
    async (text: string, contextOverride?: string) => {
      if (!text.trim() || isGenerating) return;

      const service = createAiService();
      if (!service.isConfigured()) return;

      // Add user message
      addMessage({ role: 'user', content: text.trim() });
      setInput('');

      // Add empty assistant message
      addMessage({ role: 'assistant', content: '' });
      setGenerating(true);

      const controller = new AbortController();
      setAbortController(controller);

      try {
        // Build messages for the API
        const chatMessages = useAiStore.getState().messages
          .filter((m) => m.content.length > 0)
          .slice(0, -1) // Exclude the empty assistant message we just added
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        const generator = service.chat(chatMessages, {
          context: contextOverride,
        });

        for await (const chunk of generator) {
          if (controller.signal.aborted) break;
          appendToLastMessage(chunk);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          appendToLastMessage(`\n\n[Error: ${errorMessage}]`);
        }
      } finally {
        setGenerating(false);
        setAbortController(null);
      }
    },
    [isGenerating, createAiService, addMessage, setGenerating, setAbortController, appendToLastMessage]
  );

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setGenerating(false);
      setAbortController(null);
    }
  }, [abortController, setGenerating, setAbortController]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  // Quick actions
  const handleSummarize = useCallback(() => {
    if (!currentDocument) return;
    const context = `You are summarizing a page from a knowledge base.\n\nPage title: ${currentDocument.title}\n\nPage content:\n${currentDocument.body}`;
    sendMessage(t('ai.summarize'), context);
  }, [currentDocument, sendMessage, t]);

  const handleTranslateEn = useCallback(() => {
    if (!currentDocument) return;
    const context = `You are translating a page from a knowledge base to English. Translate the following content to English, preserving markdown formatting.\n\nPage title: ${currentDocument.title}\n\nPage content:\n${currentDocument.body}`;
    sendMessage(t('ai.translateEn'), context);
  }, [currentDocument, sendMessage, t]);

  const handleTranslateJa = useCallback(() => {
    if (!currentDocument) return;
    const context = `You are translating a page from a knowledge base to Japanese. Translate the following content to Japanese, preserving markdown formatting.\n\nPage title: ${currentDocument.title}\n\nPage content:\n${currentDocument.body}`;
    sendMessage(t('ai.translateJa'), context);
  }, [currentDocument, sendMessage, t]);

  const handleRewrite = useCallback(() => {
    if (!currentDocument) return;
    const context = `You are rewriting a page from a knowledge base. Improve the clarity, structure, and readability while preserving the meaning and markdown formatting.\n\nPage title: ${currentDocument.title}\n\nPage content:\n${currentDocument.body}`;
    sendMessage(t('ai.rewrite'), context);
  }, [currentDocument, sendMessage, t]);

  const handleAskKnowledge = useCallback(async () => {
    if (!input.trim()) return;

    try {
      const container = getContainer();
      const results = container.searchService.search(input);
      const topResults = results.slice(0, 3);

      let context = 'Here are relevant pages from the knowledge base:\n\n';
      for (const result of topResults) {
        try {
          const doc = await container.documentService.get(result.id);
          context += `---\nTitle: ${doc.title}\n\n${doc.body}\n\n`;
        } catch {
          // Skip documents that cannot be loaded
        }
      }

      if (topResults.length === 0) {
        // If no search results, include titles of all docs for context
        context += 'Available pages:\n';
        for (const doc of documents) {
          context += `- ${doc.title}\n`;
        }
      }

      context += '---\n\nAnswer the user\'s question based on the knowledge base content above. If the answer cannot be found in the provided pages, say so.';

      sendMessage(input, context);
    } catch {
      sendMessage(input);
    }
  }, [input, documents, sendMessage]);

  // Process pending actions from AiContextMenu
  useEffect(() => {
    if (!pendingAction || isGenerating) return;

    const { type, text } = pendingAction;
    setPendingAction(null);

    let prompt = '';
    let context = '';

    switch (type) {
      case 'summarize':
        prompt = t('ai.summarizeSelection');
        context = `Summarize the following selected text concisely:\n\n${text}`;
        break;
      case 'translate':
        prompt = t('ai.translateSelection');
        context = `Translate the following text. If it's in Japanese, translate to English. If it's in English, translate to Japanese. Preserve formatting.\n\n${text}`;
        break;
      case 'rewrite':
        prompt = t('ai.rewriteSelection');
        context = `Rewrite the following text to improve clarity and readability while preserving the meaning:\n\n${text}`;
        break;
      case 'explain':
        prompt = t('ai.explainSelection');
        context = `Explain the following text in simple terms:\n\n${text}`;
        break;
    }

    if (prompt) {
      sendMessage(prompt, context);
    }
  }, [pendingAction, isGenerating, setPendingAction, sendMessage, t]);

  if (!panelOpen) return null;

  const service = createAiService();
  const isConfigured = service.isConfigured();

  return (
    <aside
      className="h-full flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-main)] relative select-none"
      style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
    >
      {/* Resize handle (left edge) */}
      <div
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-10"
        onMouseDown={handleResizeMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('ai.title')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            title={t('ai.clear')}
          >
            {t('ai.clear')}
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-lg leading-none"
            title={t('common.close')}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Not configured notice */}
      {!isConfigured && (
        <div className="px-4 py-3 bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
          {t('ai.notConfigured')}
        </div>
      )}

      {/* Quick actions */}
      {isConfigured && currentDocument && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-[var(--color-border)] flex-shrink-0">
          <QuickActionButton label={t('ai.summarize')} onClick={handleSummarize} disabled={isGenerating} />
          <QuickActionButton label={t('ai.translateEn')} onClick={handleTranslateEn} disabled={isGenerating} />
          <QuickActionButton label={t('ai.translateJa')} onClick={handleTranslateJa} disabled={isGenerating} />
          <QuickActionButton label={t('ai.rewrite')} onClick={handleRewrite} disabled={isGenerating} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 select-text">
        {messages.length === 0 && (
          <div className="text-center text-sm text-[var(--color-text-secondary)] mt-8">
            {t('ai.placeholder')}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            {t('ai.generating')}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-[var(--color-border)] flex-shrink-0">
        {isGenerating ? (
          <button
            onClick={handleStop}
            className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            {t('ai.stop')}
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('ai.placeholder')}
                disabled={!isConfigured}
                rows={2}
                className="flex-1 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAskKnowledge}
                disabled={!isConfigured || !input.trim()}
                className="flex-1 px-2 py-1.5 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('ai.askKnowledge')}
              </button>
              <button
                type="submit"
                disabled={!isConfigured || !input.trim()}
                className="px-4 py-1.5 text-xs rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('ai.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}

function QuickActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
