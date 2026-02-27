import { Node, mergeAttributes } from '@tiptap/core';
import i18next from 'i18next';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      setMermaidBlock: (content?: string) => ReturnType;
    };
  }
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-mermaid': '',
        class: 'mermaid-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'mermaid-block';
      container.style.cssText =
        'border: 1px solid var(--color-border); border-radius: 6px; padding: 16px; margin: 8px 0; background: var(--color-bg-sidebar); cursor: pointer; position: relative;';

      const renderMermaid = async () => {
        try {
          const mermaid = (await import('mermaid')).default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
          });
          const id = `mermaid-${Math.random().toString(36).slice(2)}`;
          const { svg } = await mermaid.render(id, node.attrs.content);
          container.innerHTML = svg;
        } catch {
          container.innerHTML = `<pre style="color: var(--color-danger); font-size: 13px; white-space: pre-wrap;">${escapeHtml(node.attrs.content)}</pre>`;
        }

        // Add overlay hint
        const hint = document.createElement('div');
        hint.style.cssText =
          'position: absolute; top: 4px; right: 8px; font-size: 11px; color: var(--color-text-secondary); opacity: 0.6;';
        hint.textContent = i18next.t('editor.slashCommand.doubleClickToEdit');
        container.appendChild(hint);
      };

      if (node.attrs.content) {
        renderMermaid();
      } else {
        container.innerHTML =
          `<p style="color: var(--color-text-secondary); font-size: 13px;">${i18next.t('editor.slashCommand.emptyMermaid')}</p>`;
      }

      container.addEventListener('dblclick', () => {
        const newContent = prompt(i18next.t('editor.slashCommand.editMermaid'), node.attrs.content);
        if (newContent !== null && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) tr.setNodeMarkup(pos, undefined, { content: newContent });
              return true;
            })
            .run();
        }
      });

      return { dom: container };
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void; ensureNewLine: () => void; closeBlock: (node: unknown) => void }, node: { attrs: { content: string } }) {
          state.write('```mermaid\n');
          state.write(node.attrs.content || '');
          state.ensureNewLine();
          state.write('```');
          state.closeBlock(node);
        },
        parse: {
          // After markdown-it renders, convert <code class="language-mermaid"> to <div data-mermaid>
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
              const pre = code.parentElement;
              if (!pre) return;
              const div = document.createElement('div');
              div.setAttribute('data-mermaid', '');
              div.setAttribute('content', code.textContent || '');
              div.className = 'mermaid-block';
              pre.replaceWith(div);
            });
          },
        },
      },
    };
  },

  addCommands() {
    return {
      setMermaidBlock:
        (content = 'graph LR\n  A --> B') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content },
          });
        },
    };
  },
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
