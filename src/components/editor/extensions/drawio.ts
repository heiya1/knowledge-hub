import { Node, mergeAttributes } from '@tiptap/core';
import i18next from 'i18next';
import { resolveAssetUrl } from './resolve-asset';

export interface DrawioBlockOptions {
  workspacePath: string;
  /** Ref object whose .current holds the document directory (e.g. "jenkins/") */
  documentDirRef?: { current: string };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawioBlock: {
      setDrawioBlock: (src?: string) => ReturnType;
    };
  }
}

export const DrawioBlock = Node.create<DrawioBlockOptions>({
  name: 'drawioBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addOptions() {
    return {
      workspacePath: '',
      documentDirRef: undefined,
    };
  },

  addAttributes() {
    return {
      src: { default: '' },
      diagramFile: { default: '' },
      width: { default: null },
      border: { default: false },
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
    const { workspacePath, documentDirRef } = this.options;
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.className = 'drawio-block';

      // Track current attrs so update() and dblclick can use latest values
      let currentSrc = node.attrs.src || '';
      let currentDiagramFile = node.attrs.diagramFile || '';

      const applyContainerStyles = (w: string | null, b: boolean) => {
        container.style.cssText =
          `border-radius: 6px; padding: 16px; margin: 8px 0; text-align: center; cursor: pointer; background: transparent; position: relative; max-width: ${w || '100%'}; ${b ? 'border: 2px solid var(--color-content-border);' : 'border: none;'}`;
      };
      applyContainerStyles(node.attrs.width, node.attrs.border);

      /** Rebuild content area (image or placeholder). Preserves the hint label. */
      const renderContent = (src: string) => {
        // Remove everything except the hint (last child)
        const hint = container.querySelector('.drawio-hint');
        while (container.firstChild) container.removeChild(container.firstChild);

        if (src) {
          const img = document.createElement('img');
          img.src = resolveAssetUrl(src, workspacePath, documentDirRef?.current);
          img.style.cssText = 'max-width: 100%; height: auto;';
          img.alt = 'draw.io diagram';
          container.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.cssText =
            'padding: 32px; color: var(--color-text-secondary); font-size: 14px;';
          placeholder.innerHTML =
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 8px; display: block; opacity: 0.5;"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>' +
            `${i18next.t('editor.slashCommand.drawioPlaceholder')}<br><small>${i18next.t('editor.slashCommand.drawioPlaceholderHint')}</small>`;
          container.appendChild(placeholder);
        }

        // Re-add hint
        if (hint) {
          container.appendChild(hint);
        } else {
          const newHint = document.createElement('div');
          newHint.className = 'drawio-hint';
          newHint.style.cssText =
            'position: absolute; top: 4px; right: 8px; font-size: 11px; color: var(--color-text-secondary); opacity: 0.6;';
          newHint.textContent = 'draw.io';
          container.appendChild(newHint);
        }
      };

      renderContent(currentSrc);

      container.addEventListener('dblclick', () => {
        if (typeof getPos === 'function') {
          window.dispatchEvent(new CustomEvent('drawio-edit', {
            detail: {
              src: currentSrc,
              diagramFile: currentDiagramFile,
              pos: getPos(),
              editor,
            },
          }));
        }
      });

      return {
        dom: container,
        selectNode() {
          container.classList.add('ProseMirror-selectednode');
          // Inline styles for maximum specificity — suppresses any
          // browser-native outline on contenteditable="false" nodes.
          container.style.outline = 'none';
          container.style.boxShadow = '0 0 0 2px var(--color-node-selected)';
        },
        deselectNode() {
          container.classList.remove('ProseMirror-selectednode');
          container.style.outline = '';
          container.style.boxShadow = '';
        },
        update(updatedNode) {
          if (updatedNode.type.name !== 'drawioBlock') return false;
          // Update styles
          applyContainerStyles(updatedNode.attrs.width, updatedNode.attrs.border);
          // Track diagramFile changes
          currentDiagramFile = updatedNode.attrs.diagramFile || '';
          // Update image if src changed (handles placeholder → image transition)
          const newSrc = updatedNode.attrs.src || '';
          if (newSrc !== currentSrc) {
            currentSrc = newSrc;
            renderContent(newSrc);
          }
          return true;
        },
      };
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (text: string) => void; ensureNewLine: () => void; closeBlock: (node: unknown) => void }, node: { attrs: { src: string; diagramFile: string; width: string | null; border: boolean } }) {
          if (node.attrs.src) {
            state.write(`![diagram](${node.attrs.src})`);
            if (node.attrs.diagramFile) {
              state.ensureNewLine();
              // Build extended comment with width/border
              let comment = `<!-- drawio:${node.attrs.diagramFile}`;
              if (node.attrs.width) comment += ` width=${node.attrs.width}`;
              if (node.attrs.border) comment += ` border`;
              comment += ` -->`;
              state.write(comment);
            }
          } else if (node.attrs.diagramFile) {
            let comment = `<!-- drawio:${node.attrs.diagramFile}`;
            if (node.attrs.width) comment += ` width=${node.attrs.width}`;
            if (node.attrs.border) comment += ` border`;
            comment += ` -->`;
            state.write(comment);
          } else {
            state.write('<!-- drawio -->');
          }
          state.closeBlock(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            // Convert drawio comments + images to drawio blocks.
            // Collect all matching comments FIRST, then mutate the DOM.
            // Modifying the DOM during TreeWalker iteration causes it to
            // skip nodes, so only the first drawio block would be detected.
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
            const comments: Comment[] = [];
            let c: Comment | null;
            while ((c = walker.nextNode() as Comment | null)) {
              const text = c.textContent?.trim() || '';
              if (text.match(/^drawio:/)) {
                comments.push(c);
              }
            }

            for (const comment of comments) {
              const text = comment.textContent?.trim() || '';
              const match = text.match(/^drawio:(\S+)(.*)$/);
              if (!match) continue;
              const diagramFile = match[1].trim();
              const rest = match[2] || '';
              // Parse width and border from rest
              const widthMatch = rest.match(/width=(\S+)/);
              const width = widthMatch ? widthMatch[1] : '';
              const border = /\bborder\b/.test(rest);
              // Check previous sibling for an image
              const prev = comment.previousElementSibling;
              let src = '';
              if (prev?.tagName === 'P') {
                const img = prev.querySelector('img');
                if (img) {
                  src = img.getAttribute('src') || '';
                  prev.remove();
                }
              }
              const div = document.createElement('div');
              div.setAttribute('data-drawio', '');
              div.setAttribute('src', src);
              div.setAttribute('diagramFile', diagramFile);
              if (width) div.setAttribute('width', width);
              if (border) div.setAttribute('border', 'true');
              div.className = 'drawio-block';
              comment.replaceWith(div);
            }

            // Also detect images whose src ends with .drawio.png / .drawio.svg / etc.
            // These are draw.io exports without an explicit <!-- drawio:... --> comment.
            // Convert them to drawio blocks so users can edit them with draw.io.
            const drawioImgPattern = /\.drawio\.(png|svg|jpg|jpeg|webp)$/i;
            const imgs = Array.from(element.querySelectorAll('img'));
            for (const img of imgs) {
              const src = img.getAttribute('src') || '';
              if (!drawioImgPattern.test(src)) continue;
              // Skip if already inside a data-drawio div (already processed)
              if (img.closest('[data-drawio]')) continue;
              // Derive the .drawio source path by stripping the image extension
              const diagramFile = src.replace(drawioImgPattern, '.drawio');
              const div = document.createElement('div');
              div.setAttribute('data-drawio', '');
              div.setAttribute('src', src);
              div.setAttribute('diagramFile', diagramFile);
              div.className = 'drawio-block';
              // Replace the <p><img></p> wrapper or the <img> itself
              const parent = img.parentElement;
              if (parent?.tagName === 'P' && parent.childNodes.length === 1) {
                parent.replaceWith(div);
              } else {
                img.replaceWith(div);
              }
            }
          },
        },
      },
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
