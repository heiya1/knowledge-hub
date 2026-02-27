import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dateNode: {
      setDateNode: (date?: string) => ReturnType;
    };
  }
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export const DateNode = Node.create({
  name: 'dateNode',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      date: {
        default: todayISO(),
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-date') || todayISO(),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-date': attributes.date,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-date]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const dateStr = node.attrs.date as string;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-date': dateStr,
        class: 'date-badge',
      }),
      formatDate(dateStr),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const span = document.createElement('span');
      const dateStr = (node.attrs.date as string) || todayISO();

      span.className = 'date-badge';
      span.setAttribute('data-date', dateStr);
      span.textContent = formatDate(dateStr);
      span.style.cssText = `
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 13px;
        background: var(--color-bg-sidebar, #F4F5F7);
        color: var(--color-accent, #0052CC);
        border: 1px solid var(--color-border, #DFE1E6);
        cursor: pointer;
        vertical-align: middle;
      `;

      span.addEventListener('dblclick', () => {
        const newDate = prompt('Date (YYYY-MM-DD)', node.attrs.date);
        if (newDate !== null && typeof getPos === 'function') {
          // Validate the date input
          const parsed = new Date(newDate);
          const validDate = isNaN(parsed.getTime()) ? node.attrs.date : newDate;

          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const pos = getPos();
              if (pos != null) {
                tr.setNodeMarkup(pos, undefined, { date: validDate });
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
        serialize(state: { write: (text: string) => void }, node: { attrs: { date: string } }) {
          state.write(`<span data-date="${node.attrs.date}" class="date-badge">${formatDate(node.attrs.date)}</span>`);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setDateNode:
        (date?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { date: date || todayISO() },
          });
        },
    };
  },
});
