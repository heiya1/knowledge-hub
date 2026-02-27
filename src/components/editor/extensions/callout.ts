import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'tip' | 'error';

const calloutStyles: Record<CalloutType, { bg: string; border: string; icon: string }> = {
  info: { bg: '#e3f2fd', border: '#2196f3', icon: '\u2139\uFE0F' },
  warning: { bg: '#fff3e0', border: '#ff9800', icon: '\u26A0\uFE0F' },
  tip: { bg: '#e8f5e9', border: '#4caf50', icon: '\uD83D\uDCA1' },
  error: { bg: '#fbe9e7', border: '#f44336', icon: '\u274C' },
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-callout-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = calloutStyles[node.attrs.type as CalloutType] || calloutStyles.info;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        'data-callout-type': node.attrs.type,
        class: `callout callout-${node.attrs.type}`,
        style: `border-left: 4px solid ${style.border}; padding: 12px 16px; border-radius: 4px; margin: 8px 0;`,
      }),
      ['span', { class: 'callout-icon', style: 'margin-right: 8px;' }, style.icon],
      ['div', { class: 'callout-content', style: 'display: inline;' }, 0],
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
            wrapBlock: (delim: string, firstDelim: string | null, node: unknown, f: () => void) => void;
          },
          node: { attrs: { type: string } } & { forEach: (fn: (child: unknown, offset: number, index: number) => void) => void },
        ) {
          state.wrapBlock('> ', '> ', node, () => {
            state.write(`[!${node.attrs.type}]\n`);
            state.renderContent(node);
          });
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // Convert blockquotes starting with [!type] to callout divs
            element.querySelectorAll('blockquote').forEach((bq) => {
              const firstChild = bq.firstElementChild;
              if (!firstChild) return;
              const text = firstChild.textContent || '';
              const match = text.match(/^\[!(info|warning|tip|error)\]\s*/);
              if (!match) return;
              const calloutType = match[1];
              // Remove the [!type] prefix from the first child
              firstChild.textContent = text.slice(match[0].length);
              if (!firstChild.textContent) firstChild.remove();
              // Create callout div
              const div = document.createElement('div');
              div.setAttribute('data-callout', '');
              div.setAttribute('data-callout-type', calloutType);
              div.className = `callout callout-${calloutType}`;
              // Move blockquote children into the callout
              while (bq.firstChild) div.appendChild(bq.firstChild);
              bq.replaceWith(div);
            });
          },
        },
      },
    };
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType = 'info') =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { type });
        },
    };
  },
});
