import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ImageIcon, Trash2, Images, Search, ChevronDown, X, ChevronLeft, ChevronRight, Fullscreen } from 'lucide-react';
import { showToast } from '../common/Toast';
import type { IFileSystem } from '../../core/interfaces/IFileSystem';

interface OrphanImage {
  filename: string;
  selected: boolean;
}

interface ImageEntry {
  relativePath: string;
  filename: string;
  ext: string;
  usedBy: string[];
  mtime: number;
  birthtime: number;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
const SKIP_DIRS = new Set(['.git', '.trash', 'node_modules', '.vscode']);
const PAGE_SIZE = 30;

type SortKey = 'name' | 'path' | 'pages' | 'created' | 'modified';
type UsageFilter = 'all' | 'used' | 'unused';

interface ImageCleanupViewProps {
  onBack: () => void;
  workspacePath: string;
  fs: IFileSystem;
}

/** Try to build a browser-accessible URL for a local file (Tauri only) */
function tryConvertFileSrc(path: string): string | null {
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      // Use the Tauri runtime's convertFileSrc (injected by the Rust backend)
      const internals = (window as Record<string, unknown>).__TAURI_INTERNALS__ as
        | { convertFileSrc?: (p: string, protocol?: string) => string }
        | undefined;
      if (internals?.convertFileSrc) {
        return internals.convertFileSrc(path);
      }
      // Fallback: use URL API to properly encode pathname (not encodeURIComponent which encodes slashes)
      const url = new URL('asset://localhost');
      url.pathname = path;
      return url.toString();
    }
  } catch {
    // Not in Tauri environment
  }
  return null;
}

type TabMode = 'browse' | 'cleanup';

export function ImageCleanupView({ onBack, workspacePath, fs }: ImageCleanupViewProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<TabMode>('browse');

  // --- Browse state ---
  const [allImages, setAllImages] = useState<ImageEntry[]>([]);
  const [browseScanning, setBrowseScanning] = useState(false);
  const [browseScanned, setBrowseScanned] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [extFilter, setExtFilter] = useState<string>('all');
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('modified');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Available extensions from scanned images
  const availableExts = useMemo(() => {
    const exts = new Set(allImages.map((img) => img.ext));
    return Array.from(exts).sort();
  }, [allImages]);

  const filteredImages = useMemo(() => {
    let result = allImages;

    // Text filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (img) =>
          img.filename.toLowerCase().includes(q) ||
          img.relativePath.toLowerCase().includes(q) ||
          img.usedBy.some((p) => p.toLowerCase().includes(q))
      );
    }

    // Extension filter
    if (extFilter !== 'all') {
      result = result.filter((img) => img.ext === extFilter);
    }

    // Usage filter
    if (usageFilter === 'used') {
      result = result.filter((img) => img.usedBy.length > 0);
    } else if (usageFilter === 'unused') {
      result = result.filter((img) => img.usedBy.length === 0);
    }

    // Sort
    const sorted = [...result];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'path':
        sorted.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        break;
      case 'pages':
        sorted.sort((a, b) => b.usedBy.length - a.usedBy.length);
        break;
      case 'created':
        sorted.sort((a, b) => b.birthtime - a.birthtime);
        break;
      case 'modified':
        sorted.sort((a, b) => b.mtime - a.mtime);
        break;
    }

    return sorted;
  }, [allImages, filterText, extFilter, usageFilter, sortKey]);

  const visibleImages = useMemo(
    () => filteredImages.slice(0, visibleCount),
    [filteredImages, visibleCount]
  );
  const hasMore = visibleCount < filteredImages.length;

  // --- Cleanup state ---
  const [orphans, setOrphans] = useState<OrphanImage[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- Image preview modal ---
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewIndex, setPreviewIndex] = useState(-1);

  /** List of images currently navigable in the modal (depends on active tab) */
  const previewList = useMemo(() => {
    if (tab === 'browse') {
      return filteredImages.map((img) => ({
        src: tryConvertFileSrc(`${workspacePath}/${img.relativePath}`),
        name: img.filename,
      }));
    }
    return orphans.map((img) => ({
      src: tryConvertFileSrc(`${workspacePath}/assets/images/${img.filename}`),
      name: img.filename,
    }));
  }, [tab, filteredImages, orphans, workspacePath]);

  const openPreview = useCallback((src: string | null, name: string, index: number) => {
    if (!src) return;
    setPreviewSrc(src);
    setPreviewName(name);
    setPreviewIndex(index);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewName('');
    setPreviewIndex(-1);
  }, []);

  const navigatePreview = useCallback((delta: number) => {
    const next = previewIndex + delta;
    if (next < 0 || next >= previewList.length) return;
    const entry = previewList[next];
    if (entry.src) {
      setPreviewSrc(entry.src);
      setPreviewName(entry.name);
      setPreviewIndex(next);
    }
  }, [previewIndex, previewList]);

  // Keyboard navigation for the preview modal
  useEffect(() => {
    if (!previewSrc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      else if (e.key === 'ArrowLeft') navigatePreview(-1);
      else if (e.key === 'ArrowRight') navigatePreview(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewSrc, closePreview, navigatePreview]);

  const imagesDir = `${workspacePath}/assets/images`;

  /** Recursively collect all image files from a directory */
  const collectAllImages = useCallback(async (dir: string, basePath: string): Promise<ImageEntry[]> => {
    const results: ImageEntry[] = [];
    try {
      const entries = await fs.readDir(dir);
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
          if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
          const sub = await collectAllImages(fullPath, basePath);
          results.push(...sub);
        } else if (entry.isFile) {
          const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
          if (IMAGE_EXTENSIONS.has(ext)) {
            const relativePath = fullPath.slice(basePath.length).replace(/^\//, '');
            let mtime = 0;
            let birthtime = 0;
            try {
              const s = await fs.stat(fullPath);
              mtime = s.mtime?.getTime() ?? 0;
              birthtime = s.birthtime?.getTime() ?? 0;
            } catch { /* skip */ }
            results.push({ relativePath, filename: entry.name, ext, usedBy: [], mtime, birthtime });
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
    return results;
  }, [fs]);

  /** Recursively collect all .md files from a directory */
  const collectMdFiles = useCallback(async (dir: string): Promise<string[]> => {
    const paths: string[] = [];
    try {
      const dirExists = await fs.exists(dir);
      if (!dirExists) return paths;
      const entries = await fs.readDir(dir);
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isFile && entry.name.endsWith('.md')) {
          paths.push(fullPath);
        } else if (entry.isDirectory && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          const sub = await collectMdFiles(fullPath);
          paths.push(...sub);
        }
      }
    } catch {
      // Skip unreadable directories
    }
    return paths;
  }, [fs]);

  /** Extract title from frontmatter (simple regex) */
  const extractTitle = (content: string, fallbackName: string): string => {
    const m = content.match(/^---\r?\n[\s\S]*?title:\s*"?([^"\n]+)"?\s*\n[\s\S]*?\n---/);
    return m?.[1]?.trim() || fallbackName;
  };

  const handleBrowseScan = useCallback(async () => {
    setBrowseScanning(true);
    setVisibleCount(PAGE_SIZE);
    try {
      const images = await collectAllImages(workspacePath, workspacePath);

      // Build image filename → page titles mapping
      const mdFiles = await collectMdFiles(workspacePath);
      const imageMap = new Map<string, Set<string>>();

      for (const mdPath of mdFiles) {
        try {
          const content = await fs.readTextFile(mdPath);
          const pageName = extractTitle(content, mdPath.split('/').pop()?.replace(/\.md$/, '') ?? '');
          for (const img of images) {
            if (content.includes(img.filename)) {
              if (!imageMap.has(img.filename)) imageMap.set(img.filename, new Set());
              imageMap.get(img.filename)!.add(pageName);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      for (const img of images) {
        img.usedBy = Array.from(imageMap.get(img.filename) ?? []);
      }

      setAllImages(images);
      setBrowseScanned(true);
    } catch (e) {
      showToast('error', String(e));
    } finally {
      setBrowseScanning(false);
    }
  }, [workspacePath, collectAllImages, collectMdFiles, fs]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const dirExists = await fs.exists(imagesDir);
      if (!dirExists) {
        setOrphans([]);
        setScanned(true);
        setScanning(false);
        return;
      }
      const imageEntries = await fs.readDir(imagesDir);
      const allImgs = imageEntries.filter((e) => e.isFile).map((e) => e.name);

      if (allImgs.length === 0) {
        setOrphans([]);
        setScanned(true);
        setScanning(false);
        return;
      }

      const mdFiles = await collectMdFiles(workspacePath);
      const imageSet = new Set(allImgs);
      const referencedImages = new Set<string>();

      for (const mdPath of mdFiles) {
        try {
          const content = await fs.readTextFile(mdPath);
          for (const img of imageSet) {
            if (content.includes(img)) {
              referencedImages.add(img);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      const orphanList: OrphanImage[] = allImgs
        .filter((img) => !referencedImages.has(img))
        .map((filename) => ({ filename, selected: true }));

      setOrphans(orphanList);
      setScanned(true);
    } catch (e) {
      setOrphans([]);
      setScanned(true);
      showToast('error', t('imageCleanup.scanFailed', { error: String(e) }));
    } finally {
      setScanning(false);
    }
  }, [imagesDir, workspacePath, fs, collectMdFiles, t]);

  const toggleSelect = useCallback((filename: string) => {
    setOrphans((prev) =>
      prev.map((o) => (o.filename === filename ? { ...o, selected: !o.selected } : o))
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setOrphans((prev) => {
      const allSelected = prev.every((o) => o.selected);
      return prev.map((o) => ({ ...o, selected: !allSelected }));
    });
  }, []);

  const handleDelete = useCallback(async () => {
    const toDelete = orphans.filter((o) => o.selected);
    if (toDelete.length === 0) return;

    setDeleting(true);
    let deletedCount = 0;
    for (const img of toDelete) {
      try {
        await fs.removeFile(`${imagesDir}/${img.filename}`);
        deletedCount++;
      } catch {
        // Skip files that can't be deleted
      }
    }
    setOrphans((prev) => prev.filter((o) => !o.selected));
    setDeleting(false);

    if (deletedCount > 0) {
      showToast('success', t('imageCleanup.deleted', { count: deletedCount }));
    }
    if (deletedCount < toDelete.length) {
      showToast('error', t('imageCleanup.deleteFailed', { count: toDelete.length - deletedCount }));
    }
  }, [orphans, imagesDir, fs, t]);

  const selectedCount = orphans.filter((o) => o.selected).length;
  const allSelected = orphans.length > 0 && orphans.every((o) => o.selected);

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-accent text-accent'
        : 'border-transparent text-text-secondary hover:text-text-primary'
    }`;

  const selectClass =
    'px-2 py-1 text-xs rounded border border-border bg-bg-main text-text-primary outline-none focus:border-accent appearance-none cursor-pointer';

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    const lang = i18n.language;
    // POSIX locale "C" is not a valid BCP 47 tag — fall back to browser default
    const locale = lang && lang !== 'C' && lang !== 'POSIX' ? lang : undefined;
    return new Date(ts).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-main">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('imageCleanup.back')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6 shrink-0">
        <button className={tabClass(tab === 'browse')} onClick={() => setTab('browse')}>
          <Images className="w-4 h-4" />
          {t('imageCleanup.browseTab')}
        </button>
        <button className={tabClass(tab === 'cleanup')} onClick={() => setTab('cleanup')}>
          <Trash2 className="w-4 h-4" />
          {t('imageCleanup.cleanupTab')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'browse' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">
                {t('imageCleanup.browseTitle')}
              </h1>
              <p className="text-sm text-text-secondary">
                {t('imageCleanup.browseNotice')}
              </p>
            </div>

            <button
              onClick={handleBrowseScan}
              disabled={browseScanning}
              className="px-6 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {browseScanning ? t('imageCleanup.scanning') : t('imageCleanup.scan')}
            </button>

            {browseScanned && allImages.length === 0 && (
              <div className="py-12 text-center text-sm text-text-secondary">
                {t('imageCleanup.noImages')}
              </div>
            )}

            {allImages.length > 0 && (
              <>
                {/* Filter bar */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary pointer-events-none" />
                      <input
                        type="text"
                        value={filterText}
                        onChange={(e) => { setFilterText(e.target.value); setVisibleCount(PAGE_SIZE); }}
                        placeholder={t('imageCleanup.filterPlaceholder')}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-bg-main text-text-primary placeholder:text-text-secondary outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Extension filter */}
                    <div className="relative">
                      <select
                        value={extFilter}
                        onChange={(e) => { setExtFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
                        className={selectClass}
                      >
                        <option value="all">{t('imageCleanup.allTypes')}</option>
                        {availableExts.map((ext) => (
                          <option key={ext} value={ext}>{ext.toUpperCase()}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary pointer-events-none" />
                    </div>

                    {/* Usage filter */}
                    <div className="relative">
                      <select
                        value={usageFilter}
                        onChange={(e) => { setUsageFilter(e.target.value as UsageFilter); setVisibleCount(PAGE_SIZE); }}
                        className={selectClass}
                      >
                        <option value="all">{t('imageCleanup.usageAll')}</option>
                        <option value="used">{t('imageCleanup.usageUsed')}</option>
                        <option value="unused">{t('imageCleanup.usageUnused')}</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary pointer-events-none" />
                    </div>

                    {/* Sort */}
                    <div className="relative">
                      <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        className={selectClass}
                      >
                        <option value="modified">{t('imageCleanup.sortModified')}</option>
                        <option value="created">{t('imageCleanup.sortCreated')}</option>
                        <option value="name">{t('imageCleanup.sortName')}</option>
                        <option value="path">{t('imageCleanup.sortPath')}</option>
                        <option value="pages">{t('imageCleanup.sortPages')}</option>
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-secondary pointer-events-none" />
                    </div>

                    <span className="text-xs text-text-secondary ml-auto">
                      {filterText.trim() || extFilter !== 'all' || usageFilter !== 'all'
                        ? t('imageCleanup.filteredCount', { shown: filteredImages.length, total: allImages.length })
                        : t('imageCleanup.imageCount', { count: allImages.length })}
                    </span>
                  </div>
                </div>

                {filteredImages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-text-secondary">
                    {t('imageCleanup.noFilterResults')}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {visibleImages.map((img, idx) => {
                        const thumbSrc = tryConvertFileSrc(`${workspacePath}/${img.relativePath}`);
                        return (
                          <div
                            key={img.relativePath}
                            className="group border border-border rounded-lg bg-bg-main hover:border-accent hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer"
                            onClick={() => openPreview(thumbSrc, img.filename, idx)}
                          >
                            <div className="aspect-square bg-bg-hover flex items-center justify-center overflow-hidden rounded-t-lg">
                              {thumbSrc ? (
                                <img
                                  src={thumbSrc}
                                  alt={img.filename}
                                  className="w-full h-full object-contain"
                                  loading="lazy"
                                />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-text-secondary" />
                              )}
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="text-xs font-medium text-text-primary truncate" title={img.filename}>
                                {img.filename}
                              </p>
                              <p className="text-[10px] text-text-secondary truncate" title={img.relativePath}>
                                {img.relativePath}
                              </p>
                              {img.usedBy.length > 0 ? (
                                <p className="text-[10px] text-accent truncate mt-0.5" title={img.usedBy.join(', ')}>
                                  {img.usedBy.join(', ')}
                                </p>
                              ) : (
                                <p className="text-[10px] text-text-secondary/50 mt-0.5">
                                  {t('imageCleanup.unusedLabel')}
                                </p>
                              )}
                              <p className="text-[10px] text-text-secondary/60 mt-0.5">
                                {formatDate(img.mtime)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasMore && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                          className="px-6 py-2 text-sm text-accent hover:underline"
                        >
                          {t('imageCleanup.loadMore', { remaining: filteredImages.length - visibleCount })}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'cleanup' && (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary mb-2">
                {t('imageCleanup.title')}
              </h1>
              <p className="text-sm text-text-secondary">
                {t('imageCleanup.notice')}
              </p>
            </div>

            {/* Scan button */}
            <div>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="px-6 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {scanning ? t('imageCleanup.scanning') : t('imageCleanup.scan')}
              </button>
            </div>

            {/* Results */}
            {scanned && orphans.length === 0 && (
              <div className="py-12 text-center text-sm text-text-secondary">
                {t('imageCleanup.noOrphans')}
              </div>
            )}

            {orphans.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {t('imageCleanup.orphanCount', { count: orphans.length })}
                  </h2>
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-accent hover:underline"
                  >
                    {allSelected ? t('imageCleanup.deselectAll') : t('imageCleanup.selectAll')}
                  </button>
                </div>

                <div className="space-y-1 border border-border rounded-lg overflow-hidden">
                  {orphans.map((img, idx) => {
                    const thumbSrc = tryConvertFileSrc(`${imagesDir}/${img.filename}`);
                    return (
                      <div
                        key={img.filename}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={img.selected}
                          onChange={() => toggleSelect(img.filename)}
                          className="w-4 h-4 rounded border-border accent-accent focus:ring-accent cursor-pointer flex-shrink-0"
                        />
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt={img.filename}
                            className="w-8 h-8 object-cover rounded border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded border border-border bg-bg-hover flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-4 h-4 text-text-secondary" />
                          </div>
                        )}
                        <span
                          className="text-sm text-text-primary truncate flex-1 cursor-pointer hover:text-accent transition-colors"
                          onClick={() => openPreview(thumbSrc, img.filename, idx)}
                        >
                          {img.filename}
                        </span>
                        <button
                          onClick={() => openPreview(thumbSrc, img.filename, idx)}
                          className="p-1 rounded text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors flex-shrink-0"
                          title={t('imageCleanup.preview')}
                        >
                          <Fullscreen className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <button
                    onClick={handleDelete}
                    disabled={selectedCount === 0 || deleting}
                    className="px-6 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('imageCleanup.deleteSelected')} {selectedCount > 0 && `(${selectedCount})`}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Image preview lightbox */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closePreview}
        >
          {/* Close button */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Filename */}
          <div className="absolute top-4 left-4 right-16 text-sm text-white/80 truncate z-10">
            {previewName}
            <span className="ml-2 text-white/50 text-xs">
              {previewIndex + 1} / {previewList.length}
            </span>
          </div>

          {/* Prev button */}
          {previewIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePreview(-1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next button */}
          {previewIndex < previewList.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigatePreview(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image with background */}
          <div
            className="w-[80vw] h-[80vh] bg-bg-main rounded-lg shadow-2xl overflow-hidden flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewSrc}
              alt={previewName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
