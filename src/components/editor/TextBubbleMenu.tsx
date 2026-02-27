import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Tooltip } from '../common/Tooltip';

interface TextBubbleMenuProps {
  editor: Editor;
}

export function TextBubbleMenu({ editor }: TextBubbleMenuProps) {
  const { t } = useTranslation();

  const btnClass = (isActive: boolean) =>
    `px-2 py-1 text-sm font-medium rounded transition-colors ${
      isActive
        ? 'bg-accent/20 text-accent'
        : 'text-text-primary hover:bg-bg-hover'
    }`;

  return (
    <BubbleMenu
      pluginKey="textBubbleMenu"
      editor={editor}
      shouldShow={({ editor: e, from, to }) => {
        if (from === to) return false;
        if (e.isActive('codeBlock')) return false;
        if (e.isActive('image')) return false;
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-bg-main border border-content-border rounded-lg shadow-lg">
        <Tooltip content={t('editor.toolbar.bold')}>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnClass(editor.isActive('bold'))}
          >
            <strong>B</strong>
          </button>
        </Tooltip>
        <Tooltip content={t('editor.toolbar.italic')}>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnClass(editor.isActive('italic'))}
          >
            <em>I</em>
          </button>
        </Tooltip>
        <Tooltip content={t('editor.toolbar.underline')}>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={btnClass(editor.isActive('underline'))}
          >
            <u>U</u>
          </button>
        </Tooltip>
        <Tooltip content={t('editor.toolbar.strikethrough')}>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={btnClass(editor.isActive('strike'))}
          >
            <s>S</s>
          </button>
        </Tooltip>
        <Tooltip content={t('editor.toolbar.code')}>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={btnClass(editor.isActive('code'))}
          >
            {'<>'}
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btnClass(editor.isActive('heading', { level: 1 }))}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive('heading', { level: 2 }))}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive('heading', { level: 3 }))}
        >
          H3
        </button>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        <Tooltip content={t('editor.toolbar.bulletList')}>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnClass(editor.isActive('bulletList'))}
          >
            {'\u2022'}
          </button>
        </Tooltip>
        <Tooltip content={t('editor.toolbar.quote')}>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={btnClass(editor.isActive('blockquote'))}
          >
            {'\u275D'}
          </button>
        </Tooltip>
      </div>
    </BubbleMenu>
  );
}
