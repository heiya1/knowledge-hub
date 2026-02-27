import { Node, mergeAttributes } from '@tiptap/core';

export type StatusColor = 'grey' | 'blue' | 'green' | 'yellow' | 'red';

export interface StatusBadgeAttrs {
  text: string;
  color: StatusColor;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statusBadge: {
      setStatusBadge: (attrs?: Partial<StatusBadgeAttrs>) => ReturnType;
    };
  }
}

export const StatusBadge = Node.create({
  name: 'statusBadge',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      text: {
        default: 'TODO',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-status-text') || 'TODO',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-status-text': attributes.text,
        }),
      },
      color: {
        default: 'grey' as StatusColor,
        parseHTML: (element: HTMLElement) =>
          (element.getAttribute('data-status-color') as StatusColor) || 'grey',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-status-color': attributes.color,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-status-text]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const color = node.attrs.color as StatusColor;
    const text = node.attrs.text as string;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-status-text': text,
        'data-status-color': color,
        class: `status-badge status-badge-${color}`,
      }),
      text,
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const colorMap: Record<StatusColor, { bg: string; text: string; border: string }> = {
        grey: { bg: '#DFE1E6', text: '#42526E', border: '#C1C7D0' },
        blue: { bg: '#DEEBFF', text: '#0747A6', border: '#B3D4FF' },
        green: { bg: '#E3FCEF', text: '#006644', border: '#ABF5D1' },
        yellow: { bg: '#FFFAE6', text: '#FF8B00', border: '#FFE380' },
        red: { bg: '#FFEBE6', text: '#BF2600', border: '#FFBDAD' },
      };

      const span = document.createElement('span');
      const color = (node.attrs.color as StatusColor) || 'grey';
      const text = (node.attrs.text as string) || 'TODO';
      const style = colorMap[color] || colorMap.grey;

      span.className = `status-badge status-badge-${color}`;
      span.setAttribute('data-status-text', text);
      span.setAttribute('data-status-color', color);
      span.textContent = text;
      span.style.cssText = `
        display: inline-block;
        padding: 1px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        line-height: 1.6;
        background: ${style.bg};
        color: ${style.text};
        border: 1px solid ${style.border};
        cursor: pointer;
        vertical-align: middle;
      `;

      span.addEventListener('dblclick', () => {
        const newText = prompt('Status text', node.attrs.text);
        if (newText !== null && typeof getPos === 'function') {
          const colors: StatusColor[] = ['grey', 'blue', 'green', 'yellow', 'red'];
          const currentIdx = colors.indexOf(node.attrs.color as StatusColor);
          const newColor = prompt(
            `Status color (${colors.join('/')})`,
            colors[currentIdx] || 'grey'
          );
          const validColor = colors.includes(newColor as StatusColor)
            ? (newColor as StatusColor)
            : node.attrs.color;

          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) {
                tr.setNodeMarkup(pos, undefined, {
                  text: newText,
                  color: validColor,
                });
              }
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
        serialize(state: { write: (text: string) => void }, node: { attrs: { text: string; color: string } }) {
          state.write(`<span data-status-text="${node.attrs.text}" data-status-color="${node.attrs.color}">${node.attrs.text}</span>`);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setStatusBadge:
        (attrs?: Partial<StatusBadgeAttrs>) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              text: attrs?.text ?? 'TODO',
              color: attrs?.color ?? 'grey',
            },
          });
        },
    };
  },
});
