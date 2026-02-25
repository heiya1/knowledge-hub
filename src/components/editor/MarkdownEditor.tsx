import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
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
import { DrawioBlock } from './extensions/drawio';
import Youtube from '@tiptap/extension-youtube';

const lowlight = createLowlight(common);

interface MarkdownEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onNavigate?: (id: string) => void;
  editable?: boolean;
}

export function MarkdownEditor({ content, onUpdate, onNavigate, editable = true }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const isSettingContent = useRef(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number } | null>(null);

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
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[var(--color-accent)] underline' },
      }),
      Image,
      Placeholder.configure({
        placeholder: t('editor.placeholder'),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
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
      DrawioBlock,
      Youtube.configure({
        inline: false,
        ccLanguage: 'en',
      }),
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
    if (editor && content !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentMd = (editor.storage as any).markdown?.getMarkdown() ?? '';
      if (currentMd !== content) {
        isSettingContent.current = true;
        editor.commands.setContent(content);
        isSettingContent.current = false;
      }
    }
  }, [content, editor]);

  return (
    <div className="relative flex-1 overflow-y-auto">
      <EditorContent editor={editor} className="h-full" />
      {editor && onNavigate && (
        <WikiLinkSuggestion editor={editor} onNavigate={onNavigate} />
      )}
      {editor && (
        <SlashCommandPopup
          editor={editor}
          isOpen={slashOpen}
          position={slashPosition}
          onClose={handleSlashClose}
        />
      )}
    </div>
  );
}

export { type MarkdownEditorProps };
