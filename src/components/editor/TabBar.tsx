import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Columns2, Rows2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabStore } from '../../stores/tabStore';
import type { Tab } from '../../stores/tabStore';
import { Tooltip } from '../common/Tooltip';

export interface PaneTabBarProps {
  paneId: string;
  tabs: Tab[];
  activeTabId: string | null;
  isActivePane: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onPaneClosed: () => void;
}

/* ---------- Sortable tab item ---------- */
function SortableTab({
  tab,
  isActive,
  onSelect,
  onClose,
  onMiddleClick,
  onContextMenu,
}: {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onMiddleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onMouseDown={onMiddleClick}
      onContextMenu={onContextMenu}
      className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-[13px] border-r border-border max-w-[180px] min-w-0 shrink-0 cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-bg-main text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
    >
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
      )}
      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
      )}
      <span className="truncate">{tab.title || t('editor.untitled')}</span>
      <span
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="ml-auto w-4 h-4 flex items-center justify-center rounded shrink-0 opacity-0 group-hover:opacity-100 hover:bg-border transition-all"
      >
        <X className="w-3 h-3" />
      </span>
    </div>
  );
}

/* ---------- Split dropdown ---------- */
function SplitDropdown({ paneId, onPaneClosed }: { paneId: string; onPaneClosed: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const { splitPane, closePane, hasSplit } = useTabStore();
  const isSplit = hasSplit();

  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);

  // Calculate fixed position from button rect
  const getMenuPos = () => {
    if (!btnRef.current) return { top: 0, left: 0 };
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 176; // w-44 = 11rem = 176px
    let left = rect.right - menuWidth;
    // Prevent left overflow
    if (left < 4) left = 4;
    // Prevent right overflow
    if (left + menuWidth > window.innerWidth - 4) left = window.innerWidth - menuWidth - 4;
    return { top: rect.bottom + 4, left };
  };

  return (
    <div className="relative shrink-0" onMouseDown={(e) => e.stopPropagation()}>
      <Tooltip content={t('tabs.split')}>
        <button
          ref={btnRef}
          onClick={() => setOpen(v => !v)}
          className={`w-7 h-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors ${isSplit ? 'text-accent' : ''}`}
        >
          <Columns2 className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      {open && (
        <div
          className="fixed z-50 w-44 rounded-lg shadow-lg border border-border bg-bg-main py-1"
          style={getMenuPos()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { splitPane(paneId, 'horizontal'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
          >
            <Columns2 className="w-4 h-4 shrink-0" />
            {t('tabs.splitRight')}
          </button>
          <button
            onClick={() => { splitPane(paneId, 'vertical'); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
          >
            <Rows2 className="w-4 h-4 shrink-0" />
            {t('tabs.splitDown')}
          </button>
          {isSplit && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => { closePane(paneId); onPaneClosed(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
              >
                {t('tabs.closeSplit')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Per-Pane TabBar ---------- */
export function PaneTabBar({ paneId, tabs, activeTabId, isActivePane, onSelectTab, onCloseTab, onPaneClosed }: PaneTabBarProps) {
  const { t } = useTranslation();
  const { reorderPaneTabs, closePaneOtherTabs, closePaneAllTabs, splitPane } = useTabStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = tabs.findIndex(t => t.id === active.id);
    const toIndex = tabs.findIndex(t => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderPaneTabs(paneId, fromIndex, toIndex);
    }
  }, [tabs, paneId, reorderPaneTabs]);

  const handleMiddleClick = useCallback((e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onCloseTab(tabId);
    }
  }, [onCloseTab]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const h = () => setContextMenu(null);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [contextMenu]);

  return (
    <div className={`flex items-center h-[35px] border-b bg-bg-tabbar shrink-0 ${
      isActivePane ? 'border-accent' : 'border-border'
    }`}>
      <div className="flex items-center min-w-0 overflow-x-auto flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => onSelectTab(tab.id)}
                onClose={() => onCloseTab(tab.id)}
                onMiddleClick={(e) => handleMiddleClick(e, tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <SplitDropdown paneId={paneId} onPaneClosed={onPaneClosed} />

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-lg shadow-lg border border-border bg-bg-main py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onCloseTab(contextMenu.tabId); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('tabs.close')}
          </button>
          <button
            onClick={() => { closePaneOtherTabs(paneId, contextMenu.tabId); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('tabs.closeOthers')}
          </button>
          <button
            onClick={() => { closePaneAllTabs(paneId); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('tabs.closeAll')}
          </button>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => { splitPane(paneId, 'horizontal'); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('tabs.splitRight')}
          </button>
          <button
            onClick={() => { splitPane(paneId, 'vertical'); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
          >
            {t('tabs.splitDown')}
          </button>
        </div>
      )}
    </div>
  );
}
