import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      setMathInline: (latex: string) => ReturnType;
    };
    mathBlock: {
      setMathBlock: (latex: string) => ReturnType;
    };
  }
}

// Inline math: $...$
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }),
      0,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const span = document.createElement('span');
      span.setAttribute('data-math-inline', '');
      span.style.cssText = 'display: inline-block; cursor: pointer;';

      const renderKatex = async () => {
        try {
          const katex = (await import('katex')).default;
          katex.render(node.attrs.latex, span, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          span.textContent = `$${node.attrs.latex}$`;
          span.style.color = 'var(--color-danger)';
        }
      };
      renderKatex();

      span.addEventListener('dblclick', () => {
        const newLatex = prompt('Edit inline LaTeX:', node.attrs.latex);
        if (newLatex !== null && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) tr.setNodeMarkup(pos, undefined, { latex: newLatex });
              return true;
            })
            .run();
        }
      });

      return { dom: span };
    };
  },

  addCommands() {
    return {
      setMathInline:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },
});

// Block math: $$...$$
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-math-block': '' }),
      0,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const div = document.createElement('div');
      div.setAttribute('data-math-block', '');
      div.style.cssText =
        'text-align: center; padding: 16px 0; margin: 8px 0; cursor: pointer;';

      const renderKatex = async () => {
        try {
          const katex = (await import('katex')).default;
          katex.render(node.attrs.latex, div, {
            throwOnError: false,
            displayMode: true,
          });
        } catch {
          div.textContent = `$$${node.attrs.latex}$$`;
          div.style.color = 'var(--color-danger)';
        }
      };
      renderKatex();

      div.addEventListener('dblclick', () => {
        const newLatex = prompt('Edit block LaTeX:', node.attrs.latex);
        if (newLatex !== null && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) tr.setNodeMarkup(pos, undefined, { latex: newLatex });
              return true;
            })
            .run();
        }
      });

      return { dom: div };
    };
  },

  addCommands() {
    return {
      setMathBlock:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    };
  },
});
