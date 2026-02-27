import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    expandBlock: {
      setExpandBlock: (title?: string) => ReturnType;
    };
  }
}

export const ExpandBlock = Node.create({
  name: 'expandBlock',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      title: {
        default: 'Click to expand',
        parseHTML: (element: HTMLElement) => {
          const summary = element.querySelector('summary');
          return summary?.textContent || 'Click to expand';
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-expand-title': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details[data-expand]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-expand': '',
        'data-expand-title': node.attrs.title,
        class: 'expand-block',
      }),
      [
        'summary',
        {
          class: 'expand-block-summary',
          style:
            'cursor: pointer; font-weight: 600; padding: 8px 0; user-select: none;',
        },
        node.attrs.title as string,
      ],
      [
        'div',
        {
          class: 'expand-block-content',
          style: 'padding: 8px 0 8px 16px;',
        },
        0,
      ],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const details = document.createElement('details');
      details.className = 'expand-block';
      details.setAttribute('data-expand', '');
      details.style.cssText =
        'border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 16px; margin: 8px 0;';

      const summary = document.createElement('summary');
      summary.className = 'expand-block-summary';
      summary.style.cssText =
        'cursor: pointer; font-weight: 600; padding: 4px 0; user-select: none; outline: none;';
      summary.textContent = node.attrs.title;

      // Allow editing the title on double-click
      summary.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newTitle = prompt('Edit expand title', node.attrs.title);
        if (newTitle !== null && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  title: newTitle,
                });
              }
              return true;
            })
            .run();
        }
      });

      const contentDom = document.createElement('div');
      contentDom.className = 'expand-block-content';
      contentDom.style.cssText = 'padding: 8px 0 8px 16px;';

      details.appendChild(summary);
      details.appendChild(contentDom);

      // Open by default in editor so content is accessible
      details.open = true;

      return {
        dom: details,
        contentDOM: contentDom,
      };
    };
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
          node: { attrs: { title: string } },
        ) {
          state.write(`<details data-expand>\n<summary>${node.attrs.title}</summary>\n\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write('</details>');
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setExpandBlock:
        (title = 'Click to expand') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { title },
            content: [{ type: 'paragraph' }],
          });
        },
    };
  },
});
