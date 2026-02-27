import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, X, Replace, ReplaceAll } from 'lucide-react';
import type { SearchReplaceStorage } from './extensions/search-replace';
import { Tooltip } from '../common/Tooltip';

interface FindReplaceProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

export function FindReplace({ editor, isOpen, onClose }: FindReplaceProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storage = (editor.storage as any).searchReplace as SearchReplaceStorage | undefined;
  const resultCount = storage?.results.length ?? 0;
  const currentIndex = storage?.currentIndex ?? 0;

  // Focus the search input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    } else {
      // Clear search decorations when closing
      editor.commands.clearSearch();
      setSearchTerm('');
      setReplaceTerm('');
    }
  }, [isOpen, editor]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      editor.commands.setSearchTerm(value);
    },
    [editor]
  );

  const handleReplaceChange = useCallback(
    (value: string) => {
      setReplaceTerm(value);
      editor.commands.setReplaceTerm(value);
    },
    [editor]
  );

  const handleNext = useCallback(() => {
    editor.commands.nextSearchResult();
  }, [editor]);

  const handlePrev = useCallback(() => {
    editor.commands.prevSearchResult();
  }, [editor]);

  const handleReplaceOne = useCallback(() => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceOne();
  }, [editor, replaceTerm]);

  const handleReplaceAll = useCallback(() => {
    editor.commands.setReplaceTerm(replaceTerm);
    editor.commands.replaceAll();
  }, [editor, replaceTerm]);

  const handleClose = useCallback(() => {
    editor.commands.clearSearch();
    onClose();
  }, [editor, onClose]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleNext, handlePrev, handleClose]
  );

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleReplaceOne();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleReplaceOne, handleClose]
  );

  if (!isOpen) return null;

  const countLabel =
    resultCount > 0
      ? t('editor.findReplace.countOf', '{{current}} of {{total}}', {
          current: currentIndex + 1,
          total: resultCount,
        })
      : searchTerm
        ? t('editor.findReplace.noResults', 'No results')
        : '';

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-content-border bg-bg-main">
      {/* Search row */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('editor.findReplace.searchPlaceholder', 'Find...')}
            className="w-full px-2 py-1 text-sm rounded border border-content-border bg-bg-main text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
        </div>

        <span className="text-xs text-text-secondary whitespace-nowrap min-w-[60px] text-center">
          {countLabel}
        </span>

        <Tooltip content={t('editor.findReplace.prevMatch', 'Previous match (Shift+Enter)')}>
          <button
            onClick={handlePrev}
            disabled={resultCount === 0}
            className="p-1 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip content={t('editor.findReplace.nextMatch', 'Next match (Enter)')}>
          <button
            onClick={handleNext}
            disabled={resultCount === 0}
            className="p-1 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-content-border mx-1" />

        {/* Replace input */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => handleReplaceChange(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder={t('editor.findReplace.replacePlaceholder', 'Replace...')}
            className="w-full px-2 py-1 text-sm rounded border border-content-border bg-bg-main text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
        </div>

        <Tooltip content={t('editor.findReplace.replace', 'Replace')}>
          <button
            onClick={handleReplaceOne}
            disabled={resultCount === 0}
            className="p-1 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <Replace className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip content={t('editor.findReplace.replaceAll', 'Replace All')}>
          <button
            onClick={handleReplaceAll}
            disabled={resultCount === 0}
            className="p-1 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-30 disabled:cursor-default transition-colors"
          >
            <ReplaceAll className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Close button */}
      <Tooltip content={t('editor.findReplace.close', 'Close (Escape)')}>
        <button
          onClick={handleClose}
          className="p-1 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );
}
