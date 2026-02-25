import { Node, mergeAttributes } from '@tiptap/core';

export interface WikiLinkOptions {
  onNavigate: (pageId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: { pageId: string; pageTitle: string }) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      onNavigate: () => {},
    };
  },

  addAttributes() {
    return {
      pageId: { default: null },
      pageTitle: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': '',
        'data-page-id': node.attrs.pageId,
        class: 'wiki-link',
      }),
      node.attrs.pageTitle,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const span = document.createElement('span');
      span.setAttribute('data-wiki-link', '');
      span.setAttribute('data-page-id', node.attrs.pageId || '');
      span.className = 'wiki-link';
      span.textContent = node.attrs.pageTitle;

      span.addEventListener('click', () => {
        if (node.attrs.pageId) {
          this.options.onNavigate(node.attrs.pageId);
        }
      });

      return { dom: span };
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void }, node: { attrs: { pageTitle: string; pageId: string | null } }) {
          if (node.attrs.pageId) {
            state.write(`[[${node.attrs.pageTitle}|${node.attrs.pageId}]]`);
          } else {
            state.write(`[[${node.attrs.pageTitle}]]`);
          }
        },
        parse: {
          // Wiki link parsing from markdown is handled via custom input rules
          // and the WikiLinkSuggestion component's insertion logic.
          // When loading markdown content, [[title]] and [[title|id]] patterns
          // are converted to wikiLink nodes by the markdown preprocessing step.
        },
      },
    };
  },
});
