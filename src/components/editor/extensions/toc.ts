import { Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      insertToc: () => ReturnType;
    };
  }
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },

  renderHTML() {
    return ['div', { 'data-toc': '', class: 'toc-block' }, 0];
  },

  addNodeView() {
    return ({ editor }) => {
      const container = document.createElement('div');
      container.className = 'toc-block';
      container.style.cssText =
        'border: 1px solid var(--color-border); border-radius: 6px; padding: 16px; margin: 8px 0; background: var(--color-bg-sidebar);';

      const updateToc = () => {
        const headings: { level: number; text: string; pos: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            headings.push({
              level: node.attrs.level,
              text: node.textContent,
              pos,
            });
          }
        });

        if (headings.length === 0) {
          container.innerHTML =
            '<p style="color: var(--color-text-secondary); font-size: 13px; margin: 0;">No headings found</p>';
          return;
        }

        const title = document.createElement('div');
        title.style.cssText =
          'font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--color-text-primary);';
        title.textContent = 'Table of Contents';

        const list = document.createElement('ul');
        list.style.cssText = 'list-style: none; padding: 0; margin: 0;';

        for (const h of headings) {
          const li = document.createElement('li');
          li.style.cssText = `padding: 2px 0; padding-left: ${(h.level - 1) * 16}px; font-size: 13px; color: var(--color-accent); cursor: pointer;`;
          li.textContent = h.text;
          li.addEventListener('click', () => {
            // Scroll the heading into view when clicking TOC entry
            const pos = h.pos;
            editor.chain().focus().setTextSelection(pos).run();
            // Try to scroll element into view
            const domAtPos = editor.view.domAtPos(pos);
            if (domAtPos.node instanceof HTMLElement) {
              domAtPos.node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (domAtPos.node.parentElement) {
              domAtPos.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          li.addEventListener('mouseenter', () => {
            li.style.textDecoration = 'underline';
          });
          li.addEventListener('mouseleave', () => {
            li.style.textDecoration = 'none';
          });
          list.appendChild(li);
        }

        container.innerHTML = '';
        container.appendChild(title);
        container.appendChild(list);
      };

      updateToc();
      editor.on('update', updateToc);

      return {
        dom: container,
        destroy() {
          editor.off('update', updateToc);
        },
      };
    };
  },

  addCommands() {
    return {
      insertToc:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
