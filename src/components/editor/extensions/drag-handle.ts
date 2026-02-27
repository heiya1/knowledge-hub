import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const dragHandleKey = new PluginKey('dragHandle');

function createDragHandleElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'drag-handle';
  el.setAttribute('draggable', 'true');
  el.setAttribute('data-drag-handle', '');
  el.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
    <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
    <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
  </svg>`;
  return el;
}

function getTopLevelNodePos(view: EditorView, coords: { left: number; top: number }): number | null {
  const pos = view.posAtCoords(coords);
  if (!pos) return null;

  const $pos = view.state.doc.resolve(pos.pos);
  if ($pos.depth === 0) {
    return $pos.nodeAfter ? $pos.pos : null;
  }
  const start = $pos.before(1);
  return view.state.doc.nodeAt(start) ? start : null;
}

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let dragHandleEl: HTMLDivElement | null = null;
    let currentNodePos: number | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const showHandle = (view: EditorView, nodePos: number) => {
      if (!dragHandleEl) return;
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      currentNodePos = nodePos;
      const nodeDOM = view.nodeDOM(nodePos);
      if (!nodeDOM || !(nodeDOM instanceof HTMLElement)) {
        dragHandleEl.style.display = 'none';
        return;
      }

      const editorRect = view.dom.getBoundingClientRect();
      const nodeRect = nodeDOM.getBoundingClientRect();

      // Position handle to the left of the node
      dragHandleEl.style.display = 'flex';
      dragHandleEl.style.top = `${nodeRect.top - editorRect.top + view.dom.scrollTop}px`;
      dragHandleEl.style.left = '-28px';
    };

    const hideHandle = () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        if (dragHandleEl) {
          dragHandleEl.style.display = 'none';
        }
        currentNodePos = null;
      }, 200);
    };

    return [
      new Plugin({
        key: dragHandleKey,
        view(editorView) {
          dragHandleEl = createDragHandleElement();
          // Append to the editor's parent so we can position relative to it
          const parent = editorView.dom.parentElement;
          if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(dragHandleEl);
          }

          // Mouse down on handle: select the node
          dragHandleEl.addEventListener('mousedown', (e) => {
            if (currentNodePos === null) return;
            e.preventDefault();
            const tr = editorView.state.tr;
            const sel = NodeSelection.create(editorView.state.doc, currentNodePos);
            editorView.dispatch(tr.setSelection(sel));
          });

          // Drag start on handle
          dragHandleEl.addEventListener('dragstart', (e) => {
            if (currentNodePos === null) return;
            const topNode = editorView.state.doc.nodeAt(currentNodePos);
            if (!topNode) return;
            const slice = editorView.state.doc.slice(
              currentNodePos,
              currentNodePos + topNode.nodeSize
            );
            // Select the node so ProseMirror handles the drag
            const sel = NodeSelection.create(editorView.state.doc, currentNodePos);
            editorView.dispatch(editorView.state.tr.setSelection(sel));

            // Set drag data
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', '');
            }

            // Let ProseMirror handle the actual drop
            editorView.dragging = {
              slice,
              move: true,
            };
          });

          // Keep handle visible when hovering over it
          dragHandleEl.addEventListener('mouseenter', () => {
            if (hideTimeout) {
              clearTimeout(hideTimeout);
              hideTimeout = null;
            }
          });

          dragHandleEl.addEventListener('mouseleave', () => {
            hideHandle();
          });

          return {
            destroy() {
              if (dragHandleEl && dragHandleEl.parentElement) {
                dragHandleEl.parentElement.removeChild(dragHandleEl);
              }
              dragHandleEl = null;
              if (hideTimeout) clearTimeout(hideTimeout);
            },
          };
        },
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              if (!view.editable) return false;

              const coords = { left: event.clientX, top: event.clientY };
              const nodePos = getTopLevelNodePos(view, coords);

              if (nodePos !== null) {
                showHandle(view, nodePos);
              } else {
                hideHandle();
              }
              return false;
            },
            mouseleave(_view, _event) {
              hideHandle();
              return false;
            },
            drop(_view, _event) {
              // After drop, hide handle
              setTimeout(() => hideHandle(), 100);
              return false;
            },
          },
        },
      }),
    ];
  },
});
