import { Node, mergeAttributes } from '@tiptap/core';

export type ColumnCount = 2 | 3;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count?: ColumnCount) => ReturnType;
    };
  }
}

export const Column = Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-column': '',
        class: 'column',
        style: 'flex: 1; min-width: 0; padding: 8px;',
      }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (text: string) => void; ensureNewLine: () => void; renderContent: (node: unknown) => void },
          node: unknown,
        ) {
          state.write('<div data-column>\n\n');
          state.renderContent(node);
          state.ensureNewLine();
          state.write('</div>\n');
        },
        parse: {},
      },
    };
  },
});

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',

  addAttributes() {
    return {
      count: {
        default: 2 as ColumnCount,
        parseHTML: (element: HTMLElement) => {
          const val = parseInt(element.getAttribute('data-columns-count') || '2', 10);
          return val === 3 ? 3 : 2;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-columns-count': attributes.count,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-columns]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const count = node.attrs.count as ColumnCount;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-columns': '',
        'data-columns-count': count,
        class: `columns columns-${count}`,
        style: `display: flex; gap: 16px; margin: 8px 0; border: 1px dashed var(--color-border, #DFE1E6); border-radius: 6px; padding: 8px;`,
      }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            ensureNewLine: () => void;
            closeBlock: (node: unknown) => void;
            renderContent: (node: unknown) => void;
          },
          node: { attrs: { count: number } },
        ) {
          state.write(`<div data-columns data-columns-count="${node.attrs.count}">\n\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write('</div>');
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setColumns:
        (count: ColumnCount = 2) =>
        ({ commands }) => {
          const columns = Array.from({ length: count }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }],
          }));

          return commands.insertContent({
            type: this.name,
            attrs: { count },
            content: columns,
          });
        },
    };
  },
});
