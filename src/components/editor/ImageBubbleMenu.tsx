import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

interface ImageBubbleMenuProps {
  editor: Editor;
}

const SIZE_PRESETS = [
  { key: 'sizeSmall', value: '25%' },
  { key: 'sizeMedium', value: '50%' },
  { key: 'sizeLarge', value: '75%' },
  { key: 'sizeOriginal', value: null },
] as const;

export function ImageBubbleMenu({ editor }: ImageBubbleMenuProps) {
  const { t } = useTranslation();
  const [showAltInput, setShowAltInput] = useState(false);

  const btnClass = (isActive: boolean) =>
    `p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-accent/20 text-accent'
        : 'text-text-primary hover:bg-bg-hover'
    }`;

  const getImageAttrs = useCallback(() => {
    const { node } = editor.state.selection as unknown as { node?: { attrs?: Record<string, unknown> } };
    return node?.attrs ?? {};
  }, [editor]);

  const updateImage = useCallback(
    (attrs: Record<string, unknown>) => {
      editor.chain().focus().updateAttributes('image', attrs).run();
    },
    [editor],
  );

  const handleDelete = useCallback(() => {
    editor.chain().focus().deleteSelection().run();
  }, [editor]);

  const handleAltSubmit = useCallback(
    (value: string) => {
      updateImage({ alt: value });
      setShowAltInput(false);
    },
    [updateImage],
  );

  return (
    <BubbleMenu
      pluginKey="imageBubbleMenu"
      editor={editor}
      shouldShow={({ editor: e }) => e.isActive('image')}
    >
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-bg-main border border-content-border rounded-lg shadow-lg">
        {/* Alignment */}
        <Tooltip content={t('editor.imageMenu.alignLeft')}>
          <button
            onClick={() => updateImage({ alignment: 'left' })}
            className={btnClass(getImageAttrs().alignment === 'left')}
          >
            <AlignLeft size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t('editor.imageMenu.alignCenter')}>
          <button
            onClick={() => updateImage({ alignment: 'center' })}
            className={btnClass(getImageAttrs().alignment === 'center')}
          >
            <AlignCenter size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t('editor.imageMenu.alignRight')}>
          <button
            onClick={() => updateImage({ alignment: 'right' })}
            className={btnClass(getImageAttrs().alignment === 'right')}
          >
            <AlignRight size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t('editor.imageMenu.fullWidth')}>
          <button
            onClick={() => updateImage({ alignment: 'full' })}
            className={btnClass(getImageAttrs().alignment === 'full')}
          >
            <Maximize2 size={16} />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Size presets */}
        {SIZE_PRESETS.map(({ key, value }) => {
          const currentWidth = getImageAttrs().width;
          const isActive = value === null ? !currentWidth : currentWidth === value;
          return (
            <Tooltip key={key} content={t(`editor.imageMenu.${key}`)}>
              <button
                onClick={() => updateImage({ width: value })}
                className={`px-1.5 py-1 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}
              >
                {t(`editor.imageMenu.${key}`)}
              </button>
            </Tooltip>
          );
        })}

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Border toggle */}
        <Tooltip content={t('editor.imageMenu.border')}>
          <button
            onClick={() => updateImage({ border: !getImageAttrs().border })}
            className={btnClass(!!getImageAttrs().border)}
          >
            <Square size={16} />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Alt text */}
        {showAltInput ? (
          <input
            type="text"
            className="w-32 px-2 py-0.5 text-xs border border-content-border rounded bg-bg-main text-text-primary outline-none focus:border-accent"
            defaultValue={(getImageAttrs().alt as string) ?? ''}
            placeholder={t('editor.imageMenu.altText')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAltSubmit((e.target as HTMLInputElement).value);
              } else if (e.key === 'Escape') {
                setShowAltInput(false);
              }
            }}
            onBlur={(e) => handleAltSubmit(e.target.value)}
          />
        ) : (
          <Tooltip content={t('editor.imageMenu.altText')}>
            <button
              onClick={() => setShowAltInput(true)}
              className={btnClass(false)}
            >
              <Type size={16} />
            </button>
          </Tooltip>
        )}

        <div className="w-px h-5 bg-content-border mx-0.5" />

        {/* Delete */}
        <Tooltip content={t('editor.imageMenu.delete')}>
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
