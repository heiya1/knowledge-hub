import { Node, mergeAttributes } from '@tiptap/core';
import i18next from 'i18next';

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
        const newLatex = prompt(i18next.t('editor.slashCommand.editInlineLatex'), node.attrs.latex);
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

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void }, node: { attrs: { latex: string } }) {
          state.write(`$${node.attrs.latex}$`);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // Convert <span data-math-inline> elements that survived HTML pass-through
            // Also convert $...$ patterns in text nodes
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            const replacements: { node: Text; matches: RegExpMatchArray[] }[] = [];
            let textNode: Text | null;
            while ((textNode = walker.nextNode() as Text | null)) {
              // Skip if inside a code/pre block
              if (textNode.parentElement?.closest('pre, code')) continue;
              const matches = [...textNode.textContent!.matchAll(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g)];
              if (matches.length) replacements.push({ node: textNode, matches });
            }
            for (const { node: tn, matches } of replacements) {
              const frag = document.createDocumentFragment();
              let lastIdx = 0;
              for (const m of matches) {
                const idx = m.index!;
                if (idx > lastIdx) frag.appendChild(document.createTextNode(tn.textContent!.slice(lastIdx, idx)));
                const span = document.createElement('span');
                span.setAttribute('data-math-inline', '');
                span.setAttribute('latex', m[1]);
                span.textContent = m[1];
                frag.appendChild(span);
                lastIdx = idx + m[0].length;
              }
              if (lastIdx < tn.textContent!.length) frag.appendChild(document.createTextNode(tn.textContent!.slice(lastIdx)));
              tn.replaceWith(frag);
            }
          },
        },
      },
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
        const newLatex = prompt(i18next.t('editor.slashCommand.editBlockLatex'), node.attrs.latex);
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

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void; ensureNewLine: () => void; closeBlock: (node: unknown) => void }, node: { attrs: { latex: string } }) {
          state.write('$$\n');
          state.write(node.attrs.latex);
          state.ensureNewLine();
          state.write('$$');
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // Convert $$...$$ blocks in text - look for paragraphs containing only $$...$$
            const paragraphs = element.querySelectorAll('p');
            paragraphs.forEach((p) => {
              const text = p.textContent || '';
              const match = text.match(/^\$\$([\s\S]+?)\$\$$/);
              if (match) {
                const div = document.createElement('div');
                div.setAttribute('data-math-block', '');
                div.setAttribute('latex', match[1].trim());
                div.textContent = match[1].trim();
                p.replaceWith(div);
              }
            });
          },
        },
      },
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
