import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SlashCommand {
  name: string;
  icon: string;
  description: string;
  action: (editor: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const defaultCommands: SlashCommand[] = [
  {
    name: 'Heading 1',
    icon: 'H1',
    description: 'Large heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: 'Heading 2',
    icon: 'H2',
    description: 'Medium heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: 'Heading 3',
    icon: 'H3',
    description: 'Small heading',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    name: 'Bullet List',
    icon: '\u2022',
    description: 'Unordered list',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    name: 'Numbered List',
    icon: '1.',
    description: 'Ordered list',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    name: 'Task List',
    icon: '\u2611',
    description: 'Checklist',
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    name: 'Code Block',
    icon: '{ }',
    description: 'Code snippet',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    name: 'Blockquote',
    icon: '\u275D',
    description: 'Quote block',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    name: 'Divider',
    icon: '\u2015',
    description: 'Horizontal rule',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    name: 'Table',
    icon: '\u229E',
    description: '3x3 table',
    action: (editor) =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    name: 'Callout (Info)',
    icon: '\u2139\uFE0F',
    description: 'Information callout',
    action: (editor) => editor.chain().focus().setCallout('info').run(),
  },
  {
    name: 'Callout (Warning)',
    icon: '\u26A0\uFE0F',
    description: 'Warning callout',
    action: (editor) => editor.chain().focus().setCallout('warning').run(),
  },
  {
    name: 'Callout (Tip)',
    icon: '\uD83D\uDCA1',
    description: 'Tip callout',
    action: (editor) => editor.chain().focus().setCallout('tip').run(),
  },
  {
    name: 'Callout (Error)',
    icon: '\u274C',
    description: 'Error callout',
    action: (editor) => editor.chain().focus().setCallout('error').run(),
  },
  {
    name: 'Mermaid Diagram',
    icon: '\uD83D\uDCC8',
    description: 'Insert Mermaid diagram',
    action: (editor) => editor.chain().focus().setMermaidBlock().run(),
  },
  {
    name: 'Math (Block)',
    icon: '\u2211',
    description: 'Block math equation',
    action: (editor) => {
      const latex = prompt('Enter LaTeX:', 'E = mc^2');
      if (latex) {
        editor.chain().focus().setMathBlock(latex).run();
      }
    },
  },
  {
    name: 'Table of Contents',
    icon: '\uD83D\uDCCB',
    description: 'Auto-generated TOC',
    action: (editor) => editor.chain().focus().insertToc().run(),
  },
];

export interface SlashCommandOptions {
  commands?: SlashCommand[];
  onOpen?: (query: string, coords: { top: number; left: number }) => void;
  onClose?: () => void;
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      commands: defaultCommands,
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

export { defaultCommands };
