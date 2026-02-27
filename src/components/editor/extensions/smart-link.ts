import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkCard: {
      setLinkCard: (url: string, title?: string) => ReturnType;
    };
  }
}

export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: null },
      description: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-link-card]',
      getAttrs: (element: HTMLElement) => ({
        url: element.getAttribute('url') || element.querySelector('a')?.getAttribute('href') || '',
        title: element.getAttribute('title') || element.querySelector('a')?.textContent || null,
        description: element.getAttribute('description') || null,
      }),
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const url = (HTMLAttributes.url as string) || '';
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      // invalid URL
    }
    const displayTitle = (HTMLAttributes.title as string) || hostname || url;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-link-card': '',
        class: 'link-card',
      }),
      [
        'a',
        { href: url, target: '_blank', rel: 'noopener' },
        ['span', { class: 'link-card-title' }, displayTitle],
        ['span', { class: 'link-card-url' }, url],
      ],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void; closeBlock: (node: unknown) => void }, node: { attrs: { url: string; title: string | null; description: string | null } }) {
          const url = node.attrs.url || '';
          const title = node.attrs.title || url;
          const desc = node.attrs.description || '';
          state.write(`<div data-link-card url="${url}" title="${title}" description="${desc}"><a href="${url}">${title}</a></div>`);
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // Ensure data-link-card divs have url/title/description extracted
            element.querySelectorAll('div[data-link-card]').forEach((div) => {
              if (!div.getAttribute('url')) {
                const a = div.querySelector('a');
                if (a) {
                  div.setAttribute('url', a.getAttribute('href') || '');
                  div.setAttribute('title', a.textContent || '');
                }
              }
            });
          },
        },
      },
    };
  },

  addCommands() {
    return {
      setLinkCard:
        (url: string, title?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { url, title: title || null },
          });
        },
    };
  },
});
