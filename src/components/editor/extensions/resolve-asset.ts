/**
 * Convert a workspace-relative (or document-relative) path to a browser-loadable URL.
 *
 * @param relativePath  Image src from markdown (e.g. "assets/images/foo.png", "./images/bar.png")
 * @param workspacePath Absolute filesystem path to the workspace root
 * @param documentDir   Directory of the current markdown file relative to workspace root,
 *                      WITH trailing separator (e.g. "jenkins/" for jenkins/jenkins.md).
 *                      Empty string if the file is at the workspace root.
 */
export function resolveAssetUrl(
  relativePath: string,
  workspacePath: string,
  documentDir?: string,
): string {
  if (!relativePath || !workspacePath) return relativePath;
  // Already an absolute or data URL
  if (
    relativePath.startsWith('http') ||
    relativePath.startsWith('data:') ||
    relativePath.startsWith('asset:') ||
    relativePath.startsWith('blob:')
  ) {
    return relativePath;
  }
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const sep = workspacePath.includes('\\') ? '\\' : '/';

      let abs: string;
      if (relativePath.startsWith('./') || relativePath.startsWith('../')) {
        // Document-relative path — resolve relative to the markdown file's directory
        const cleaned = relativePath.replace(/^\.\//, '');
        const dir = documentDir || '';
        abs = `${workspacePath}${sep}${dir}${cleaned}`.replace(/\//g, sep);
      } else {
        // Workspace-relative path (e.g. "assets/images/abc.png")
        abs = `${workspacePath}${sep}${relativePath}`.replace(/\//g, sep);
      }

      // Use the Tauri runtime's convertFileSrc (injected by the Rust backend)
      const internals = (window as Record<string, unknown>).__TAURI_INTERNALS__ as
        | { convertFileSrc?: (path: string, protocol?: string) => string }
        | undefined;
      if (internals?.convertFileSrc) {
        return internals.convertFileSrc(abs);
      }
      // Fallback: manual URL construction
      const url = new URL('asset://localhost');
      url.pathname = abs;
      return url.toString();
    }
  } catch {
    // Not in Tauri
  }
  return relativePath;
}
