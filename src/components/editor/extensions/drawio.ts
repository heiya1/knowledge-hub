import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawioBlock: {
      setDrawioBlock: (src?: string) => ReturnType;
    };
  }
}

export const DrawioBlock = Node.create({
  name: 'drawioBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      diagramFile: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawio]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-drawio': '',
        class: 'drawio-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'drawio-block';
      container.style.cssText =
        'border: 1px solid var(--color-border); border-radius: 6px; padding: 16px; margin: 8px 0; text-align: center; cursor: pointer; background: var(--color-bg-sidebar); position: relative;';

      if (node.attrs.src) {
        const img = document.createElement('img');
        img.src = node.attrs.src;
        img.style.cssText = 'max-width: 100%; height: auto;';
        img.alt = 'draw.io diagram';
        container.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.cssText =
          'padding: 32px; color: var(--color-text-secondary); font-size: 14px;';
        placeholder.innerHTML =
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 8px; display: block; opacity: 0.5;"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>' +
          'draw.io diagram<br><small>Double-click to set SVG source</small>';
        container.appendChild(placeholder);
      }

      const hint = document.createElement('div');
      hint.style.cssText =
        'position: absolute; top: 4px; right: 8px; font-size: 11px; color: var(--color-text-secondary); opacity: 0.6;';
      hint.textContent = 'draw.io';
      container.appendChild(hint);

      container.addEventListener('dblclick', () => {
        const newSrc = prompt('Enter draw.io SVG path or URL:', node.attrs.src);
        if (newSrc !== null && typeof getPos === 'function') {
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null)
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: newSrc,
                });
              return true;
            })
            .run();
        }
      });

      return { dom: container };
    };
  },

  addCommands() {
    return {
      setDrawioBlock:
        (src = '') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },
});
