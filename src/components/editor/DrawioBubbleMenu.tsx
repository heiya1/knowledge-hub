import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Pencil, Square, Trash2 } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface DrawioBubbleMenuProps {
  editor: Editor;
}

const SIZE_PRESETS = [
  { key: 'sizeSmall', value: '25%' },
  { key: 'sizeMedium', value: '50%' },
  { key: 'sizeLarge', value: '75%' },
  { key: 'sizeOriginal', value: null },
] as const;

export function DrawioBubbleMenu({ editor }: DrawioBubbleMenuProps) {
  const { t } = useTranslation();

  const btnClass = (isActive: boolean) =>
    `p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-accent/20 text-accent'
        : 'text-text-primary hover:bg-bg-hover'
    }`;

  const getAttrs = useCallback(() => {
    const { node } = editor.state.selection as unknown as { node?: { attrs?: Record<string, unknown> } };
    return node?.attrs ?? {};
  }, [editor]);

  const updateDrawio = useCallback(
    (attrs: Record<string, unknown>) => {
      editor.chain().focus().updateAttributes('drawioBlock', attrs).run();
    },
    [editor],
  );

  const handleEdit = useCallback(() => {
    const attrs = getAttrs();
    const pos = (editor.state.selection as unknown as { from: number }).from;
    window.dispatchEvent(new CustomEvent('drawio-edit', {
      detail: {
        src: attrs.src || '',
        diagramFile: attrs.diagramFile || '',
        pos,
        editor,
      },
    }));
  }, [editor, getAttrs]);

  const handleDelete = useCallback(() => {
    editor.chain().focus().deleteSelection().run();
  }, [editor]);

  return (
    <BubbleMenu
      pluginKey="drawioBubbleMenu"
      editor={editor}
      shouldShow={({ editor: e }) => e.isActive('drawioBlock')}
    >
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-bg-main border border-content-border rounded-lg shadow-lg">
        {/* Edit */}
        <Tooltip content={t('editor.drawioMenu.edit')}>
          <button
            onClick={handleEdit}
            className={btnClass(false)}
          >
            <Pencil size={16} />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Size presets */}
        {SIZE_PRESETS.map(({ key, value }) => {
          const currentWidth = getAttrs().width;
          const isActive = value === null ? !currentWidth : currentWidth === value;
          return (
            <Tooltip key={key} content={t(`editor.drawioMenu.${key}`)}>
              <button
                onClick={() => updateDrawio({ width: value })}
                className={`px-1.5 py-1 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}
              >
                {t(`editor.drawioMenu.${key}`)}
              </button>
            </Tooltip>
          );
        })}

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Border toggle */}
        <Tooltip content={t('editor.drawioMenu.border')}>
          <button
            onClick={() => updateDrawio({ border: !getAttrs().border })}
            className={btnClass(!!getAttrs().border)}
          >
            <Square size={16} />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Delete */}
        <Tooltip content={t('editor.drawioMenu.delete')}>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded transition-colors text-danger hover:bg-danger/10"
          >
            <Trash2 size={16} />
          </button>
        </Tooltip>
      </div>
    </BubbleMenu>
  );
}
