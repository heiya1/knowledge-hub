import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'tip' | 'error';

const calloutStyles: Record<CalloutType, { bg: string; darkBg: string; border: string; icon: string }> = {
  info: { bg: '#e3f2fd', darkBg: '#1a3a5c', border: '#2196f3', icon: '\u2139\uFE0F' },
  warning: { bg: '#fff3e0', darkBg: '#4a3520', border: '#ff9800', icon: '\u26A0\uFE0F' },
  tip: { bg: '#e8f5e9', darkBg: '#1a3c2a', border: '#4caf50', icon: '\uD83D\uDCA1' },
  error: { bg: '#fbe9e7', darkBg: '#4a2020', border: '#f44336', icon: '\u274C' },
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
