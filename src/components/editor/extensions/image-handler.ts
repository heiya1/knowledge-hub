import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { generateId } from '../../../core/utils/id';

/**
 * Maximum width for auto-resized images.
 * Per spec: JPEG at 85% quality, PNG/WebP preserve transparency, GIF/SVG no resize.
 */
const MAX_IMAGE_WIDTH = 1920;
const JPEG_QUALITY = 0.85;

/** MIME types that should NOT be resized */
const NO_RESIZE_TYPES = new Set(['image/gif', 'image/svg+xml']);

/** Map MIME type to file extension */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mime] || 'png';
}

/**
 * Reads a File/Blob into an ArrayBuffer.
 */
function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a File/Blob into a data URL string.
 */
function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an HTMLImageElement from a blob.
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Resizes an image using the canvas API if it exceeds MAX_IMAGE_WIDTH.
 * Returns { blob, resized } where resized indicates if resizing occurred.
 */
async function resizeImageIfNeeded(
  file: Blob,
  mimeType: string
): Promise<{ blob: Blob; resized: boolean }> {
  // GIF and SVG: no resize
  if (NO_RESIZE_TYPES.has(mimeType)) {
    return { blob: file, resized: false };
  }

  const img = await loadImageFromBlob(file);

  // No resize needed if within limits
  if (img.width <= MAX_IMAGE_WIDTH) {
    return { blob: file, resized: false };
  }

  const ratio = MAX_IMAGE_WIDTH / img.width;
  const newWidth = MAX_IMAGE_WIDTH;
  const newHeight = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Canvas not available, return original
    return { blob: file, resized: false };
  }

  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Determine output format and quality
  let outputMime = mimeType;
  let quality: number | undefined;

  if (mimeType === 'image/jpeg') {
    quality = JPEG_QUALITY;
  } else if (mimeType === 'image/png') {
    // PNG: preserve transparency, no quality setting
    outputMime = 'image/png';
  } else if (mimeType === 'image/webp') {
    // WebP: preserve transparency, use lossless-ish quality
    outputMime = 'image/webp';
    quality = 0.9;
  } else {
    // Fallback: output as PNG
    outputMime = 'image/png';
  }

  const resizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      outputMime,
      quality
    );
  });

  return { blob: resizedBlob, resized: true };
}

/**
 * Saves binary data to the workspace assets/images/ directory via Tauri FS.
 * Returns the relative path (e.g. "assets/images/abc123.png").
 * Falls back to a data URL if Tauri FS is not available (browser dev mode).
 */
async function saveImageToWorkspace(
  blob: Blob,
  mimeType: string,
  workspacePath: string
): Promise<string> {
  const ext = mimeToExt(mimeType);
  const id = generateId();
  const relativePath = `assets/images/${id}.${ext}`;

  try {
    // Dynamic import to avoid breaking when Tauri is not available
    const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
    const sep = workspacePath.includes('\\') ? '\\' : '/';

    const imagesDir = `${workspacePath}${sep}assets${sep}images`;

    // Ensure directory exists
    const dirExists = await exists(imagesDir);
    if (!dirExists) {
      await mkdir(imagesDir, { recursive: true });
    }

    const fullPath = `${workspacePath}${sep}assets${sep}images${sep}${id}.${ext}`;
    const arrayBuffer = await readFileAsArrayBuffer(blob);
    const uint8Array = new Uint8Array(arrayBuffer);

    await writeFile(fullPath, uint8Array);

    return relativePath;
  } catch {
    // Tauri FS not available (browser dev mode) - fall back to data URL
    console.warn('[image-handler] Tauri FS not available, using data URL fallback');
    const dataUrl = await readFileAsDataURL(blob);
    return dataUrl;
  }
}

/**
 * Processes an image file: resize if needed, save to workspace, return the path.
 */
async function processAndSaveImage(
  file: Blob,
  mimeType: string,
  workspacePath: string
): Promise<string> {
  const { blob } = await resizeImageIfNeeded(file, mimeType);
  return saveImageToWorkspace(blob, mimeType, workspacePath);
}

/**
 * Extracts image files from a paste or drop event's DataTransfer.
 */
function getImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (file.type.startsWith('image/')) {
      files.push(file);
    }
  }
  return files;
}

/**
 * Checks if a DataTransfer contains image items (for paste events
 * where the data might be in items rather than files).
 */
function getImageItems(dataTransfer: DataTransfer): DataTransferItem[] {
  const items: DataTransferItem[] = [];
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const item = dataTransfer.items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      items.push(item);
    }
  }
  return items;
}

/** Strip extension from a filename to use as alt text */
function filenameToAlt(name: string): string {
  if (!name) return '';
  return name.replace(/\.[^.]+$/, '');
}

export interface ImageHandlerOptions {
  /** Absolute path to the active workspace directory */
  workspacePath: string;
}

export const ImageHandler = Extension.create<ImageHandlerOptions>({
  name: 'imageHandler',

  addOptions() {
    return {
      workspacePath: '',
    };
  },

  addProseMirrorPlugins() {
    const { workspacePath } = this.options;

    // Track blob URLs currently being saved to avoid duplicate processing
    const processingBlobs = new Set<string>();

    return [
      new Plugin({
        key: new PluginKey('imageHandler'),
        props: {
          handlePaste: (view, event) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // Check for image items (paste from clipboard)
            const imageItems = getImageItems(clipboardData);
            if (imageItems.length === 0) return false;

            // Prevent default paste behavior for images
            event.preventDefault();

            for (const item of imageItems) {
              const file = item.getAsFile();
              if (!file) continue;

              const mimeType = file.type || 'image/png';

              const alt = filenameToAlt(file.name);
              processAndSaveImage(file, mimeType, workspacePath)
                .then((src) => {
                  const { schema } = view.state;
                  const imageNode = schema.nodes.image.create({
                    src,
                    alt,
                  });
                  const transaction = view.state.tr.replaceSelectionWith(imageNode);
                  view.dispatch(transaction);
                })
                .catch((err) => {
                  console.error('[image-handler] Failed to process pasted image:', err);
                });
            }

            return true;
          },

          handleDrop: (view, event) => {
            const dragEvent = event as DragEvent;
            const dataTransfer = dragEvent.dataTransfer;
            if (!dataTransfer) return false;

            const imageFiles = getImageFiles(dataTransfer);
            if (imageFiles.length === 0) return false;

            // Prevent default drop behavior for images
            event.preventDefault();

            // Get drop position in the document
            const pos = view.posAtCoords({
              left: dragEvent.clientX,
              top: dragEvent.clientY,
            });

            for (const file of imageFiles) {
              const mimeType = file.type || 'image/png';

              processAndSaveImage(file, mimeType, workspacePath)
                .then((src) => {
                  const { schema } = view.state;
                  const imageNode = schema.nodes.image.create({
                    src,
                    alt: filenameToAlt(file.name),
                  });
                  const insertPos = pos?.pos ?? view.state.selection.from;
                  const transaction = view.state.tr.insert(insertPos, imageNode);
                  view.dispatch(transaction);
                })
                .catch((err) => {
                  console.error('[image-handler] Failed to process dropped image:', err);
                });
            }

            return true;
          },
        },
      }),

      // Plugin that detects image nodes with blob: URLs (inserted by the
      // Markdown/HTML paste handler when the clipboard provides images as
      // HTML rather than file items), fetches the blob, saves it to disk,
      // and replaces the src with a workspace-relative path.
      new Plugin({
        key: new PluginKey('imageBlobResolver'),
        view: () => ({
          update: (view, prevState) => {
            if (prevState.doc.eq(view.state.doc)) return;

            view.state.doc.descendants((node, _pos) => {
              if (
                node.type.name === 'image' &&
                typeof node.attrs.src === 'string' &&
                node.attrs.src.startsWith('blob:') &&
                !processingBlobs.has(node.attrs.src)
              ) {
                const blobUrl = node.attrs.src;
                processingBlobs.add(blobUrl);

                fetch(blobUrl)
                  .then((res) => res.blob())
                  .then((blob) =>
                    processAndSaveImage(blob, blob.type || 'image/png', workspacePath),
                  )
                  .then((relativePath) => {
                    processingBlobs.delete(blobUrl);
                    // Position may have changed — find the node by its blob URL
                    let targetPos: number | null = null;
                    view.state.doc.descendants((n, p) => {
                      if (n.type.name === 'image' && n.attrs.src === blobUrl) {
                        targetPos = p;
                        return false;
                      }
                    });
                    if (targetPos !== null) {
                      const targetNode = view.state.doc.nodeAt(targetPos);
                      if (targetNode) {
                        view.dispatch(
                          view.state.tr.setNodeMarkup(targetPos, undefined, {
                            ...targetNode.attrs,
                            src: relativePath,
                          }),
                        );
                      }
                    }
                  })
                  .catch((err) => {
                    processingBlobs.delete(blobUrl);
                    console.error('[image-handler] Failed to resolve blob URL:', err);
                  });
              }
            });
          },
        }),
      }),
    ];
  },
});
