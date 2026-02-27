import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Underline,
  Italic,
  Strikethrough,
  Code,
  ChevronDown,
  List,
  ListOrdered,
  ListChecks,
  Baseline,
  ImagePlus,
  Smile,
  Table,
  Plus,
  Link,
  Undo2,
  Redo2,
  Minus,
  Braces,
  GitGraph,
  Sigma,
  TableOfContents,
  PenTool,
  Link2,
  Info,
  AlertTriangle,
  Lightbulb,
  AlertCircle,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Quote,
  Highlighter,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Tag,
  Calendar,
  Columns2,
  Columns3,
  PanelTopClose,
} from 'lucide-react';
import { TableGridPicker } from './TableGridPicker';
import { Tooltip } from '../common/Tooltip';

interface EditorToolbarProps {
  editor: Editor | null;
  onCollapse?: () => void;
  onOpenTagModal?: () => void;
  tagCount?: number;
}

// ---- Text color palette ----
const TEXT_COLORS: Array<{ value: string | null; labelKey: string; swatch: string }> = [
  { value: null, labelKey: 'editor.toolbar.noColor', swatch: 'transparent' },
  { value: '#172B4D', labelKey: 'editor.toolbar.colorBlack', swatch: '#172B4D' },
  { value: '#DC2626', labelKey: 'editor.toolbar.colorRed', swatch: '#DC2626' },
  { value: '#2563EB', labelKey: 'editor.toolbar.colorBlue', swatch: '#2563EB' },
  { value: '#16A34A', labelKey: 'editor.toolbar.colorGreen', swatch: '#16A34A' },
  { value: '#EA580C', labelKey: 'editor.toolbar.colorOrange', swatch: '#EA580C' },
  { value: '#9333EA', labelKey: 'editor.toolbar.colorPurple', swatch: '#9333EA' },
  { value: '#6B7280', labelKey: 'editor.toolbar.colorGray', swatch: '#6B7280' },
];

// ---- Common emoji grid ----
const EMOJI_LIST = [
  '\u{1F44D}', '\u{1F44E}', '\u{1F389}', '\u{1F525}', '\u{2705}', '\u{274C}',
  '\u{2764}\u{FE0F}', '\u{1F4A1}', '\u{1F680}', '\u{2B50}', '\u{1F4DD}', '\u{1F50D}',
  '\u{1F4AC}', '\u{1F3AF}', '\u{26A0}\u{FE0F}', '\u{1F4CC}', '\u{1F4C4}', '\u{1F4CA}',
  '\u{23F0}', '\u{1F527}', '\u{1F6A7}', '\u{1F4A4}', '\u{1F44B}', '\u{1F4AA}',
];

type DropdownKey = 'textStyle' | 'moreFormat' | 'listMenu' | 'textColor' | 'emoji' | 'tableGrid' | 'insertMenu';

export function EditorToolbar({ editor, onCollapse, onOpenTagModal, tagCount }: EditorToolbarProps) {
  const { t } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handle = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [openDropdown]);

  const toggleDropdown = useCallback((key: DropdownKey) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }, []);

  const closeDropdown = useCallback(() => {
    setOpenDropdown(null);
  }, []);

  if (!editor) return null;

  // ---- Style helpers ----
  const iconBtnClass = (isActive: boolean) =>
    `flex items-center justify-center w-8 h-8 rounded transition-colors ${
      isActive
        ? 'bg-sidebar-selected text-accent'
        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
    }`;

  const dropdownBtnClass = (isActive: boolean) =>
    `flex items-center gap-1 h-8 px-2 rounded transition-colors text-sm ${
      isActive
        ? 'bg-sidebar-selected text-accent'
        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
    }`;

  const dropdownPanelClass =
    'absolute top-full left-0 mt-1 z-50 bg-bg-main border border-border rounded-lg shadow-lg py-1 min-w-[180px]';

  const dropdownItemClass = (isActive: boolean) =>
    `w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
      isActive
        ? 'bg-sidebar-selected text-accent'
        : 'text-text-primary hover:bg-bg-hover'
    }`;

  const Separator = () => <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />;

  // ---- Detect current text style ----
  const getCurrentTextStyleLabel = (): string => {
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive('heading', { level })) {
        return t(`editor.toolbar.heading${level}`, `Heading ${level}`);
      }
    }
    if (editor.isActive('blockquote')) {
      return t('editor.toolbar.blockquote', 'Blockquote');
    }
    return t('editor.toolbar.normalText', 'Normal text');
  };

  // ---- Handlers ----
  const handleInsertImage = () => {
    closeDropdown();
    const url = prompt(t('editor.toolbar.enterImageUrl', 'Enter image URL:'));
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleInsertLink = () => {
    closeDropdown();
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt(t('editor.toolbar.enterUrl', 'Enter URL:'));
    if (url) {
      editor.chain().focus().toggleLink({ href: url }).run();
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="flex items-center border-b border-border bg-bg-main"
    >
      <div className="flex-1 flex items-center gap-0.5 px-3 py-1.5 flex-wrap min-w-0">
      {/* ====== 1. Text style dropdown ====== */}
      <div className="relative" data-dropdown="textStyle">
        <Tooltip content={t('editor.toolbar.textStyle', 'Text style')}>
          <button
            onClick={() => toggleDropdown('textStyle')}
            className={dropdownBtnClass(openDropdown === 'textStyle')}
          >
            <span className="max-w-[120px] truncate">{getCurrentTextStyleLabel()}</span>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        </Tooltip>
        {openDropdown === 'textStyle' && (
          <div className={dropdownPanelClass}>
            {/* Normal text */}
            <button
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('paragraph') && !editor.isActive('blockquote'))}
            >
              <Type className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.normalText', 'Normal text')}</span>
            </button>
            {/* Headings 1-6 */}
            {([
              { level: 1, Icon: Heading1 },
              { level: 2, Icon: Heading2 },
              { level: 3, Icon: Heading3 },
              { level: 4, Icon: Heading4 },
              { level: 5, Icon: Heading5 },
              { level: 6, Icon: Heading6 },
            ] as const).map(({ level, Icon }) => (
              <button
                key={level}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level }).run();
                  closeDropdown();
                }}
                className={dropdownItemClass(editor.isActive('heading', { level }))}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{t(`editor.toolbar.heading${level}`, `Heading ${level}`)}</span>
              </button>
            ))}
            {/* Blockquote */}
            <button
              onClick={() => {
                editor.chain().focus().toggleBlockquote().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('blockquote'))}
            >
              <Quote className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.blockquote', 'Blockquote')}</span>
            </button>
          </div>
        )}
      </div>

      <Separator />

      {/* ====== 2. Bold ====== */}
      <Tooltip content={t('editor.toolbar.bold')}>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={iconBtnClass(editor.isActive('bold'))}
        >
          <Bold className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 3. Underline ====== */}
      <Tooltip content={t('editor.toolbar.underline')}>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={iconBtnClass(editor.isActive('underline'))}
        >
          <Underline className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 4. Italic ====== */}
      <Tooltip content={t('editor.toolbar.italic')}>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={iconBtnClass(editor.isActive('italic'))}
        >
          <Italic className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 5. More text formatting dropdown (Strikethrough, Inline code) ====== */}
      <div className="relative" data-dropdown="moreFormat">
        <Tooltip content={t('editor.toolbar.moreFormatting', 'More formatting')}>
          <button
            onClick={() => toggleDropdown('moreFormat')}
            className={dropdownBtnClass(
              openDropdown === 'moreFormat' || editor.isActive('strike') || editor.isActive('code') || editor.isActive('highlight') || editor.isActive('superscript') || editor.isActive('subscript')
            )}
          >
            <Baseline className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
        </Tooltip>
        {openDropdown === 'moreFormat' && (
          <div className={dropdownPanelClass}>
            <button
              onClick={() => {
                editor.chain().focus().toggleStrike().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('strike'))}
            >
              <Strikethrough className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.strikethrough')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleCode().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('code'))}
            >
              <Code className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.code')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleHighlight().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('highlight'))}
            >
              <Highlighter className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.highlight')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleSuperscript().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('superscript'))}
            >
              <SuperscriptIcon className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.superscript')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleSubscript().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('subscript'))}
            >
              <SubscriptIcon className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.subscript')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ====== 6. List dropdown ====== */}
      <div className="relative" data-dropdown="listMenu">
        <Tooltip content={t('editor.toolbar.listMenu', 'Lists')}>
          <button
            onClick={() => toggleDropdown('listMenu')}
            className={dropdownBtnClass(
              openDropdown === 'listMenu' ||
              editor.isActive('bulletList') ||
              editor.isActive('orderedList') ||
              editor.isActive('taskList')
            )}
          >
            <List className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
        </Tooltip>
        {openDropdown === 'listMenu' && (
          <div className={dropdownPanelClass}>
            <button
              onClick={() => {
                editor.chain().focus().toggleBulletList().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('bulletList'))}
            >
              <List className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.bulletList')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleOrderedList().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('orderedList'))}
            >
              <ListOrdered className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.orderedList')}</span>
            </button>
            <button
              onClick={() => {
                editor.chain().focus().toggleTaskList().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('taskList'))}
            >
              <ListChecks className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.taskList')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ====== 7. Text color ====== */}
      <div className="relative" data-dropdown="textColor">
        <Tooltip content={t('editor.toolbar.textColor', 'Text color')}>
          <button
            onClick={() => toggleDropdown('textColor')}
            className={iconBtnClass(openDropdown === 'textColor')}
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold leading-none" style={{ color: (editor.getAttributes('textStyle')?.color as string) || 'currentColor' }}>
                A
              </span>
              <div
                className="w-4 h-1 rounded-sm mt-0.5"
                style={{ backgroundColor: (editor.getAttributes('textStyle')?.color as string) || 'currentColor' }}
              />
            </div>
          </button>
        </Tooltip>
        {openDropdown === 'textColor' && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-bg-main border border-border rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map(({ value, labelKey, swatch }) => (
                <Tooltip key={labelKey} content={t(labelKey)}>
                  <button
                    onClick={() => {
                      if (value) {
                        editor.chain().focus().setColor(value).run();
                      } else {
                        editor.chain().focus().unsetColor().run();
                      }
                      closeDropdown();
                    }}
                    className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center"
                    style={{ backgroundColor: value ? swatch : 'transparent' }}
                  >
                    {!value && (
                      <span className="text-text-secondary text-xs leading-none">{'\u2715'}</span>
                    )}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====== Text alignment ====== */}
      <Tooltip content={t('editor.toolbar.alignLeft', 'Align left')}>
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={iconBtnClass(editor.isActive({ textAlign: 'left' }))}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.alignCenter', 'Center')}>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={iconBtnClass(editor.isActive({ textAlign: 'center' }))}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip content={t('editor.toolbar.alignRight', 'Align right')}>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={iconBtnClass(editor.isActive({ textAlign: 'right' }))}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </Tooltip>

      <Separator />

      {/* ====== 8. Action item (task checkbox) ====== */}
      <Tooltip content={t('editor.toolbar.taskList')}>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={iconBtnClass(editor.isActive('taskList'))}
        >
          <ListChecks className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 9. Image insert ====== */}
      <Tooltip content={t('editor.toolbar.insertImage', 'Insert image')}>
        <button
          onClick={handleInsertImage}
          className={iconBtnClass(false)}
        >
          <ImagePlus className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 10. Emoji ====== */}
      <div className="relative" data-dropdown="emoji">
        <Tooltip content={t('editor.toolbar.emoji', 'Emoji')}>
          <button
            onClick={() => toggleDropdown('emoji')}
            className={iconBtnClass(openDropdown === 'emoji')}
          >
            <Smile className="w-4 h-4" />
          </button>
        </Tooltip>
        {openDropdown === 'emoji' && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-bg-main border border-border rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-6 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    editor.chain().focus().insertContent(emoji).run();
                    closeDropdown();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====== 11. Table insert with grid picker ====== */}
      <div className="relative" data-dropdown="tableGrid">
        <Tooltip content={t('editor.toolbar.insertTable')}>
          <button
            onClick={() => toggleDropdown('tableGrid')}
            className={iconBtnClass(openDropdown === 'tableGrid' || editor.isActive('table'))}
          >
            <Table className="w-4 h-4" />
          </button>
        </Tooltip>
        {openDropdown === 'tableGrid' && (
          <TableGridPicker
            onSelect={(rows, cols) => {
              editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
            }}
            onClose={closeDropdown}
          />
        )}
      </div>

      {/* ====== 12. + Insert menu (code block, HR, callout, mermaid, math, toc, drawio) ====== */}
      <div className="relative" data-dropdown="insertMenu">
        <Tooltip content={t('editor.toolbar.insertMenu', 'Insert')}>
          <button
            onClick={() => toggleDropdown('insertMenu')}
            className={dropdownBtnClass(openDropdown === 'insertMenu')}
          >
            <Plus className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
        </Tooltip>
        {openDropdown === 'insertMenu' && (
          <div className={dropdownPanelClass} style={{ minWidth: '200px' }}>
            {/* Code block */}
            <button
              onClick={() => {
                editor.chain().focus().toggleCodeBlock().run();
                closeDropdown();
              }}
              className={dropdownItemClass(editor.isActive('codeBlock'))}
            >
              <Braces className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.codeBlock')}</span>
            </button>
            {/* Horizontal rule */}
            <button
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Minus className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.horizontalRule')}</span>
            </button>

            <div className="h-px bg-border my-1 mx-2" />

            {/* Callout - Info */}
            <button
              onClick={() => {
                editor.chain().focus().setCallout('info').run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Info className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span>{t('editor.slashCommand.calloutInfo', 'Callout (Info)')}</span>
            </button>
            {/* Callout - Warning */}
            <button
              onClick={() => {
                editor.chain().focus().setCallout('warning').run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-yellow-500" />
              <span>{t('editor.slashCommand.calloutWarning', 'Callout (Warning)')}</span>
            </button>
            {/* Callout - Tip */}
            <button
              onClick={() => {
                editor.chain().focus().setCallout('tip').run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Lightbulb className="w-4 h-4 flex-shrink-0 text-green-500" />
              <span>{t('editor.slashCommand.calloutTip', 'Callout (Tip)')}</span>
            </button>
            {/* Callout - Error */}
            <button
              onClick={() => {
                editor.chain().focus().setCallout('error').run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{t('editor.slashCommand.calloutError', 'Callout (Error)')}</span>
            </button>

            <div className="h-px bg-border my-1 mx-2" />

            {/* Mermaid */}
            <button
              onClick={() => {
                editor.chain().focus().setMermaidBlock().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <GitGraph className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.mermaid', 'Mermaid diagram')}</span>
            </button>
            {/* Math block */}
            <button
              onClick={() => {
                const latex = prompt(t('editor.slashCommand.enterLatex', 'Enter LaTeX:'));
                if (latex) {
                  editor.chain().focus().setMathBlock(latex).run();
                }
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Sigma className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.math', 'Math equation')}</span>
            </button>
            {/* TOC */}
            <button
              onClick={() => {
                editor.chain().focus().insertToc().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <TableOfContents className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.toc', 'Table of Contents')}</span>
            </button>
            {/* draw.io */}
            <button
              onClick={() => {
                editor.chain().focus().setDrawioBlock().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <PenTool className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.drawio', 'draw.io diagram')}</span>
            </button>

            <div className="h-px bg-border my-1 mx-2" />

            {/* Expand section */}
            <button
              onClick={() => {
                editor.chain().focus().setExpandBlock().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.expand', 'Expand section')}</span>
            </button>
            {/* Status badge */}
            <button
              onClick={() => {
                const text = prompt(t('editor.slashCommand.enterStatusText', 'Enter status text:'), 'TODO');
                if (text) {
                  editor.chain().focus().setStatusBadge({ text }).run();
                }
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Tag className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.statusBadge', 'Status badge')}</span>
            </button>
            {/* Date */}
            <button
              onClick={() => {
                editor.chain().focus().setDateNode().run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.dateInsert', 'Date')}</span>
            </button>
            {/* 2-column layout */}
            <button
              onClick={() => {
                editor.chain().focus().setColumns(2).run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Columns2 className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.columns2', '2 columns')}</span>
            </button>
            {/* 3-column layout */}
            <button
              onClick={() => {
                editor.chain().focus().setColumns(3).run();
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Columns3 className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.columns3', '3 columns')}</span>
            </button>
            {/* Link card */}
            <button
              onClick={() => {
                const url = prompt(t('editor.toolbar.enterUrl', 'Enter URL:'), 'https://');
                if (url) {
                  editor.chain().focus().setLinkCard(url).run();
                }
                closeDropdown();
              }}
              className={dropdownItemClass(false)}
            >
              <Link2 className="w-4 h-4 flex-shrink-0" />
              <span>{t('editor.toolbar.linkCard', 'Link card')}</span>
            </button>
          </div>
        )}
      </div>

      <Separator />

      {/* ====== 13. Tags ====== */}
      {onOpenTagModal && (
        <Tooltip content={t('editor.addTag')}>
          <button
            onClick={onOpenTagModal}
            className={iconBtnClass(!!tagCount && tagCount > 0)}
          >
            <Tag className="w-4 h-4" />
          </button>
        </Tooltip>
      )}

      {/* ====== 14. Link ====== */}
      <Tooltip content={t('editor.toolbar.insertLink', 'Insert link')}>
        <button
          onClick={handleInsertLink}
          className={iconBtnClass(editor.isActive('link'))}
        >
          <Link className="w-4 h-4" />
        </button>
      </Tooltip>

      <Separator />

      {/* ====== 14. Undo ====== */}
      <Tooltip content={t('editor.toolbar.undo', 'Undo (Ctrl+Z)')}>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${iconBtnClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Undo2 className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* ====== 15. Redo ====== */}
      <Tooltip content={t('editor.toolbar.redo', 'Redo (Ctrl+Y)')}>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${iconBtnClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </Tooltip>

      </div>
      {/* ====== Collapse toolbar - fixed right ====== */}
      {onCollapse && (
        <Tooltip content={t('editor.toolbar.toggleToolbar')}>
          <button
            onClick={onCollapse}
            className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors shrink-0 mr-1"
          >
            <PanelTopClose className="w-4 h-4" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
