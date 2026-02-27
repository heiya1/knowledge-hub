import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { TFunction } from 'i18next';

export interface SlashCommand {
  name: string;
  icon: string;
  description: string;
  action: (editor: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function getDefaultCommands(t: TFunction): SlashCommand[] {
  return [
    {
      name: t('editor.slashCommand.heading1'),
      icon: 'H1',
      description: t('editor.slashCommand.heading1Desc'),
      action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      name: t('editor.slashCommand.heading2'),
      icon: 'H2',
      description: t('editor.slashCommand.heading2Desc'),
      action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      name: t('editor.slashCommand.heading3'),
      icon: 'H3',
      description: t('editor.slashCommand.heading3Desc'),
      action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      name: t('editor.slashCommand.bulletList'),
      icon: '\u2022',
      description: t('editor.slashCommand.bulletListDesc'),
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      name: t('editor.slashCommand.numberedList'),
      icon: '1.',
      description: t('editor.slashCommand.numberedListDesc'),
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      name: t('editor.slashCommand.taskList'),
      icon: '\u2611',
      description: t('editor.slashCommand.taskListDesc'),
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      name: t('editor.slashCommand.codeBlock'),
      icon: '{ }',
      description: t('editor.slashCommand.codeBlockDesc'),
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      name: t('editor.slashCommand.blockquote'),
      icon: '\u275D',
      description: t('editor.slashCommand.blockquoteDesc'),
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      name: t('editor.slashCommand.divider'),
      icon: '\u2015',
      description: t('editor.slashCommand.dividerDesc'),
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      name: t('editor.slashCommand.table'),
      icon: '\u229E',
      description: t('editor.slashCommand.tableDesc'),
      action: (editor) =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      name: t('editor.slashCommand.calloutInfo'),
      icon: '\u2139\uFE0F',
      description: t('editor.slashCommand.calloutInfoDesc'),
      action: (editor) => editor.chain().focus().setCallout('info').run(),
    },
    {
      name: t('editor.slashCommand.calloutWarning'),
      icon: '\u26A0\uFE0F',
      description: t('editor.slashCommand.calloutWarningDesc'),
      action: (editor) => editor.chain().focus().setCallout('warning').run(),
    },
    {
      name: t('editor.slashCommand.calloutTip'),
      icon: '\uD83D\uDCA1',
      description: t('editor.slashCommand.calloutTipDesc'),
      action: (editor) => editor.chain().focus().setCallout('tip').run(),
    },
    {
      name: t('editor.slashCommand.calloutError'),
      icon: '\u274C',
      description: t('editor.slashCommand.calloutErrorDesc'),
      action: (editor) => editor.chain().focus().setCallout('error').run(),
    },
    {
      name: t('editor.slashCommand.mermaid'),
      icon: '\uD83D\uDCC8',
      description: t('editor.slashCommand.mermaidDesc'),
      action: (editor) => editor.chain().focus().setMermaidBlock().run(),
    },
    {
      name: t('editor.slashCommand.drawio'),
      icon: '\u270F\uFE0F',
      description: t('editor.slashCommand.drawioDesc'),
      action: (editor) => editor.chain().focus().setDrawioBlock().run(),
    },
    {
      name: t('editor.slashCommand.mathBlock'),
      icon: '\u2211',
      description: t('editor.slashCommand.mathBlockDesc'),
      action: (editor) => {
        const latex = prompt(t('editor.slashCommand.enterLatex'), 'E = mc^2');
        if (latex) {
          editor.chain().focus().setMathBlock(latex).run();
        }
      },
    },
    {
      name: t('editor.slashCommand.toc'),
      icon: '\uD83D\uDCCB',
      description: t('editor.slashCommand.tocDesc'),
      action: (editor) => editor.chain().focus().insertToc().run(),
    },
    {
      name: t('editor.slashCommand.linkCard'),
      icon: '\uD83D\uDD17',
      description: t('editor.slashCommand.linkCardDesc'),
      action: (editor) => {
        const url = prompt(t('editor.slashCommand.enterUrl'), 'https://');
        if (url) editor.chain().focus().setLinkCard(url).run();
      },
    },
    {
      name: t('editor.slashCommand.expand'),
      icon: '\u25B6',
      description: t('editor.slashCommand.expandDesc'),
      action: (editor) => editor.chain().focus().setExpandBlock().run(),
    },
    {
      name: t('editor.slashCommand.status'),
      icon: '\uD83C\uDFF7\uFE0F',
      description: t('editor.slashCommand.statusDesc'),
      action: (editor) => {
        const text = prompt(t('editor.slashCommand.enterStatusText'), 'TODO');
        if (text) editor.chain().focus().setStatusBadge({ text }).run();
      },
    },
    {
      name: t('editor.slashCommand.date'),
      icon: '\uD83D\uDCC5',
      description: t('editor.slashCommand.dateDesc'),
      action: (editor) => editor.chain().focus().setDateNode().run(),
    },
    {
      name: t('editor.slashCommand.columns2'),
      icon: '\u25A5',
      description: t('editor.slashCommand.columns2Desc'),
      action: (editor) => editor.chain().focus().setColumns(2).run(),
    },
    {
      name: t('editor.slashCommand.columns3'),
      icon: '\u25A6',
      description: t('editor.slashCommand.columns3Desc'),
      action: (editor) => editor.chain().focus().setColumns(3).run(),
    },
  ];
}

export interface SlashCommandOptions {
  commands?: SlashCommand[];
  onOpen?: (query: string, coords: { top: number; left: number }) => void;
  onClose?: () => void;
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      commands: undefined,
      onOpen: undefined,
      onClose: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;

    return [
      new Plugin({
        key: new PluginKey('slashCommand'),
        props: {
          handleKeyDown(view, event) {
            if (event.key === '/') {
              const { state } = view;
              const { from } = state.selection;
              // Only trigger at start of line or after whitespace
              const textBefore = state.doc.textBetween(
                Math.max(0, from - 1),
                from
              );
              if (
                from === 1 ||
                textBefore === '' ||
                textBefore === '\n' ||
                textBefore === ' '
              ) {
                const coords = view.coordsAtPos(from);
                setTimeout(() => {
                  options.onOpen?.('', {
                    top: coords.bottom,
                    left: coords.left,
                  });
                }, 10);
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export { getDefaultCommands };
