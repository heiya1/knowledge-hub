import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { useTranslation } from 'react-i18next';
import { WikiLink } from './extensions/wiki-link';
import { WikiLinkSuggestion } from './extensions/WikiLinkSuggestion';
import { Callout } from './extensions/callout';
import { MermaidBlock } from './extensions/mermaid';
import { MathInline, MathBlock } from './extensions/math';
import { EmojiExtension } from './extensions/emoji';
import { TableOfContents } from './extensions/toc';
import { SlashCommandExtension } from './extensions/slash-command';
import { SlashCommandPopup } from './extensions/SlashCommandPopup';
import { TextBubbleMenu } from './TextBubbleMenu';
import { ImageBubbleMenu } from './ImageBubbleMenu';
import { DrawioBubbleMenu } from './DrawioBubbleMenu';
import { DrawioBlock } from './extensions/drawio';
import { DrawioEditorOverlay } from './DrawioEditorOverlay';
import { DragHandle } from './extensions/drag-handle';
import { ImageHandler } from './extensions/image-handler';
import { SearchReplace } from './extensions/search-replace';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Youtube from '@tiptap/extension-youtube';
import { ExpandBlock } from './extensions/expand';
import { StatusBadge } from './extensions/status-badge';
import { DateNode } from './extensions/date-node';
import { Columns, Column } from './extensions/columns';
import { LinkCard } from './extensions/smart-link';
import { resolveAssetUrl } from './extensions/resolve-asset';
import { Extension } from '@tiptap/core';
import { Plugin, NodeSelection } from '@tiptap/pm/state';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDocumentStore } from '../../stores/documentStore';

const lowlight = createLowlight(common);

/**
 * Plugin that toggles a CSS class on the editor when an atom node
 * (image, drawio, etc.) is selected via NodeSelection, allowing us to
 * hide the blinking caret via `caret-color: transparent`.
 *
 * The actual visual selection indicator (blue ring) is handled via
 * inline styles in each NodeView's selectNode()/deselectNode(), plus
 * CSS rules that suppress the browser's native outline on
 * contenteditable="false" elements.
 */
const HideAtomSelection = Extension.create({
  name: 'hideAtomSelection',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view() {
          return {
            update(view, prevState) {
              const isNodeSel = view.state.selection instanceof NodeSelection;
              const wasNodeSel = prevState.selection instanceof NodeSelection;
              if (isNodeSel && !wasNodeSel) {
                view.dom.classList.add('hide-atom-selection');
              } else if (!isNodeSel && wasNodeSel) {
                view.dom.classList.remove('hide-atom-selection');
              }
            },
          };
        },
      }),
    ];
  },
});

const backgroundColorAttr = {
  default: null,
  parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
  renderHTML: (attributes: Record<string, unknown>) => {
    if (!attributes.backgroundColor) return {};
    return { style: `background-color: ${attributes.backgroundColor}` };
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Check if any table cell has a backgroundColor attribute. */
function tableHasStyledCells(node: any): boolean {
  let found = false;
  node.descendants((child: any) => {
    if (child.attrs?.backgroundColor) {
      found = true;
      return false;
    }
  });
  return found;
}

/** Check if a table can be serialized as a pipe table (same logic as tiptap-markdown). */
function isMarkdownSerializable(node: any): boolean {
  const rows: any[] = node.content?.content ?? [];
  if (rows.length === 0) return false;
  const firstRow = rows[0];
  const firstRowCells: any[] = firstRow.content?.content ?? [];
  if (firstRowCells.some((cell: any) => cell.type.name !== 'tableHeader' || cell.attrs?.colspan > 1 || cell.attrs?.rowspan > 1 || cell.childCount > 1)) {
    return false;
  }
  const bodyRows = rows.slice(1);
  if (bodyRows.some((row: any) =>
    (row.content?.content ?? []).some((cell: any) => cell.type.name === 'tableHeader' || cell.attrs?.colspan > 1 || cell.attrs?.rowspan > 1 || cell.childCount > 1)
  )) {
    return false;
  }
  return true;
}

/** Render a table cell's content as inline HTML for round-tripping styled tables. */
function renderCellContentAsHtml(cell: any): string {
  let html = '';
  let firstParagraph = true;
  cell.forEach((block: any) => {
    if (block.type.name === 'paragraph') {
      if (!firstParagraph) html += '<br>';
      firstParagraph = false;
      block.forEach((inline: any) => {
        if (inline.isText) {
          let text = (inline.text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          for (const mark of inline.marks || []) {
            switch (mark.type.name) {
              case 'bold': text = `<strong>${text}</strong>`; break;
              case 'italic': text = `<em>${text}</em>`; break;
              case 'code': text = `<code>${text}</code>`; break;
              case 'underline': text = `<u>${text}</u>`; break;
              case 'strike': text = `<s>${text}</s>`; break;
              case 'link': text = `<a href="${mark.attrs.href}">${text}</a>`; break;
            }
          }
          html += text;
        }
      });
    }
  });
  return html;
}

/** Serialize a table as an HTML <table> block (preserves cell styles). */
function serializeTableAsHtml(state: any, node: any): void {
  let html = '<table>\n';
  node.forEach((row: any) => {
    html += '<tr>';
    row.forEach((cell: any) => {
      const isHeader = cell.type.name === 'tableHeader';
      const tag = isHeader ? 'th' : 'td';
      const bg = cell.attrs?.backgroundColor;
      const styleAttr = bg ? ` style="background-color: ${bg}"` : '';
      const colspan = cell.attrs?.colspan > 1 ? ` colspan="${cell.attrs.colspan}"` : '';
      const rowspan = cell.attrs?.rowspan > 1 ? ` rowspan="${cell.attrs.rowspan}"` : '';
      const content = renderCellContentAsHtml(cell);
      html += `<${tag}${styleAttr}${colspan}${rowspan}>${content}</${tag}>`;
    });
    html += '</tr>\n';
  });
  html += '</table>';
  state.write(html);
  state.closeBlock(node);
}

/** Serialize a table as a pipe table (standard markdown). Replicates tiptap-markdown logic. */
function serializeTableAsPipe(state: any, node: any): void {
  state.inTable = true;
  node.forEach((row: any, _p: number, i: number) => {
    state.write('| ');
    row.forEach((col: any, _p2: number, j: number) => {
      if (j) state.write(' | ');
      const cellContent = col.firstChild;
      if (cellContent?.textContent?.trim()) {
        state.renderInline(cellContent);
      }
    });
    state.write(' |');
    state.ensureNewLine();
    if (!i) {
      const delimiterRow = Array.from({ length: row.childCount }).map(() => '---').join(' | ');
      state.write(`| ${delimiterRow} |`);
      state.ensureNewLine();
    }
  });
  state.closeBlock(node);
  state.inTable = false;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

interface MarkdownEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onNavigate?: (id: string) => void;
  editable?: boolean;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function MarkdownEditor({ content, onUpdate, onNavigate, editable = true, onEditorReady }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const isSettingContent = useRef(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number } | null>(null);
  const activeWorkspace = useWorkspaceStore((s) => s.getActiveWorkspace());
  const workspacePath = activeWorkspace?.path ?? '';

  // Track the current document's directory relative to workspace root.
  // Uses a ref so the renderHTML closure (created once at editor init) always
  // reads the latest value when the user switches between documents.
  const currentDocumentId = useDocumentStore((s) => s.currentDocumentId);
  const documentDirRef = useRef('');
  {
    const id = currentDocumentId ?? '';
    const lastSlash = id.lastIndexOf('/');
    documentDirRef.current = lastSlash === -1 ? '' : id.substring(0, lastSlash + 1);
  }

  const handleSlashOpen = useCallback((_query: string, coords: { top: number; left: number }) => {
    setSlashPosition(coords);
    setSlashOpen(true);
  }, []);

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
    setSlashPosition(null);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        underline: {},
        link: {
          openOnClick: false,
          HTMLAttributes: { class: 'text-accent underline' },
        },
      }),
      TextStyle,
      Color,
      Image.extend({
        atom: true,
        selectable: true,
        addAttributes() {
          return {
            ...this.parent?.(),
            alignment: {
              default: null,
              renderHTML: (attrs: Record<string, unknown>) => attrs.alignment ? { 'data-alignment': attrs.alignment } : {},
              parseHTML: (el: HTMLElement) => el.getAttribute('data-alignment'),
            },
            width: {
              default: null,
              renderHTML: (attrs: Record<string, unknown>) => attrs.width ? { width: attrs.width } : {},
              parseHTML: (el: HTMLElement) => el.getAttribute('width'),
            },
            border: {
              default: false,
              renderHTML: (attrs: Record<string, unknown>) => attrs.border ? { 'data-border': '' } : {},
              parseHTML: (el: HTMLElement) => el.hasAttribute('data-border'),
            },
          };
        },
        renderHTML({ HTMLAttributes }) {
          // Resolve relative image paths to absolute Tauri asset URLs for display
          const resolved = { ...HTMLAttributes };
          if (resolved.src && typeof resolved.src === 'string') {
            resolved.src = resolveAssetUrl(resolved.src, workspacePath, documentDirRef.current);
          }
          return ['img', resolved];
        },
        addNodeView() {
          return ({ node }) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-node-view';
            const img = document.createElement('img');
            wrapper.appendChild(img);

            const applyAttrs = (attrs: Record<string, unknown>) => {
              const src = (attrs.src as string) || '';
              img.src = resolveAssetUrl(src, workspacePath, documentDirRef.current);
              img.alt = (attrs.alt as string) || '';
              if (attrs.title) img.title = attrs.title as string;
              else img.removeAttribute('title');
              if (attrs.width) img.setAttribute('width', attrs.width as string);
              else img.removeAttribute('width');
              if (attrs.alignment) {
                img.setAttribute('data-alignment', attrs.alignment as string);
                wrapper.setAttribute('data-alignment', attrs.alignment as string);
              } else {
                img.removeAttribute('data-alignment');
                wrapper.removeAttribute('data-alignment');
              }
              if (attrs.border) img.setAttribute('data-border', '');
              else img.removeAttribute('data-border');
            };

            applyAttrs(node.attrs);

            return {
              dom: wrapper,
              selectNode() {
                wrapper.classList.add('ProseMirror-selectednode');
                // Inline styles for maximum specificity — suppresses any
                // browser-native outline on contenteditable="false" nodes.
                wrapper.style.outline = 'none';
                wrapper.style.boxShadow = '0 0 0 2px var(--color-node-selected)';
                wrapper.style.borderRadius = '0.375rem';
              },
              deselectNode() {
                wrapper.classList.remove('ProseMirror-selectednode');
                wrapper.style.outline = '';
                wrapper.style.boxShadow = '';
                wrapper.style.borderRadius = '';
              },
              update(updatedNode) {
                if (updatedNode.type.name !== 'image') return false;
                applyAttrs(updatedNode.attrs);
                return true;
              },
            };
          };
        },
        addStorage() {
          return {
            markdown: {
              serialize(
                state: { write: (s: string) => void; ensureNewLine: () => void },
                node: { attrs: Record<string, unknown> },
              ) {
                const { src, alt, title, alignment, width, border } = node.attrs;
                if (alignment || width || border) {
                  let html = `<img src="${src}"`;
                  if (alt) html += ` alt="${alt}"`;
                  if (title) html += ` title="${title}"`;
                  if (alignment) html += ` data-alignment="${alignment}"`;
                  if (width) html += ` width="${width}"`;
                  if (border) html += ' data-border';
                  html += ' />';
                  state.write(html);
                  state.ensureNewLine();
                } else {
                  const altText = (alt as string) || '';
                  const titlePart = title ? ` "${title}"` : '';
                  state.write(`![${altText}](${src}${titlePart})`);
                  state.ensureNewLine();
                }
              },
              parse: {},
            },
          };
        },
      }),
      ImageHandler.configure({
        workspacePath,
      }),
      Placeholder.configure({
        placeholder: t('editor.placeholder'),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }).extend({
        addStorage() {
          return {
            markdown: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              serialize(state: any, node: any) {
                if (tableHasStyledCells(node)) {
                  // HTML table to preserve cell background colors
                  serializeTableAsHtml(state, node);
                } else if (isMarkdownSerializable(node)) {
                  // Standard pipe table
                  serializeTableAsPipe(state, node);
                } else {
                  // Complex table (spans, multi-paragraph cells) → HTML
                  serializeTableAsHtml(state, node);
                }
              },
              parse: {},
            },
          };
        },
      }),
      TableRow,
      TableCell.extend({
        addAttributes() {
          return { ...this.parent?.(), backgroundColor: backgroundColorAttr };
        },
      }),
      TableHeader.extend({
        addAttributes() {
          return { ...this.parent?.(), backgroundColor: backgroundColorAttr };
        },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      WikiLink.configure({
        onNavigate: onNavigate ?? (() => {}),
      }),
      Callout,
      MermaidBlock,
      MathInline,
      MathBlock,
      EmojiExtension,
      TableOfContents,
      DrawioBlock.configure({
        workspacePath,
        documentDirRef,
      }),
      DragHandle,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Superscript,
      Subscript,
      ExpandBlock,
      StatusBadge,
      DateNode,
      Columns,
      Column,
      LinkCard,
      Youtube.configure({
        inline: false,
        ccLanguage: 'en',
      }),
      SearchReplace,
      HideAtomSelection,
      SlashCommandExtension.configure({
        onOpen: handleSlashOpen,
        onClose: handleSlashClose,
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      if (!isSettingContent.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown.getMarkdown();
        onUpdate(md);
      }
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update editable state dynamically
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor && content !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentMd = (editor.storage as any).markdown?.getMarkdown() ?? '';
      if (currentMd !== content) {
        isSettingContent.current = true;
        editor.commands.setContent(content);
        // Move cursor to the start so atom nodes (images, drawio) don't get auto-selected
        editor.commands.setTextSelection(0);
        isSettingContent.current = false;
      }
    }
  }, [content, editor]);

  // Auto-scroll the editor when dragging near the top/bottom edge
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const EDGE_SIZE = 60; // px from edge to trigger scroll
    const MAX_SPEED = 15; // px per frame at the very edge
    let rafId = 0;
    let scrollSpeed = 0;

    const tick = () => {
      if (scrollSpeed !== 0) {
        container.scrollTop += scrollSpeed;
        rafId = requestAnimationFrame(tick);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const rect = container.getBoundingClientRect();
      const y = e.clientY;

      if (y - rect.top < EDGE_SIZE) {
        // Near top edge – scroll up
        const ratio = 1 - (y - rect.top) / EDGE_SIZE;
        scrollSpeed = -Math.round(MAX_SPEED * ratio);
      } else if (rect.bottom - y < EDGE_SIZE) {
        // Near bottom edge – scroll down
        const ratio = 1 - (rect.bottom - y) / EDGE_SIZE;
        scrollSpeed = Math.round(MAX_SPEED * ratio);
      } else {
        scrollSpeed = 0;
      }

      if (scrollSpeed !== 0 && !rafId) {
        rafId = requestAnimationFrame(tick);
      } else if (scrollSpeed === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const stopScroll = () => {
      scrollSpeed = 0;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', stopScroll);
    container.addEventListener('drop', stopScroll);
    window.addEventListener('dragend', stopScroll);

    return () => {
      stopScroll();
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', stopScroll);
      container.removeEventListener('drop', stopScroll);
      window.removeEventListener('dragend', stopScroll);
    };
  }, []);

  return (
    <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
      <EditorContent editor={editor} className="h-full" />
      {editor && (
        <WikiLinkSuggestion editor={editor} />
      )}
      {editor && (
        <>
          <SlashCommandPopup
            editor={editor}
            isOpen={slashOpen}
            position={slashPosition}
            onClose={handleSlashClose}
          />
          {editable && <TextBubbleMenu editor={editor} />}
          {editable && <ImageBubbleMenu editor={editor} />}
          {editable && <DrawioBubbleMenu editor={editor} />}
          {editable && <DrawioEditorOverlay />}
        </>
      )}
    </div>
  );
}

export { type MarkdownEditorProps };
