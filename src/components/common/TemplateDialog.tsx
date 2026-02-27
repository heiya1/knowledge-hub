import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { builtInTemplates, type PageTemplate } from '../../core/templates';

interface TemplateDialogProps {
  isOpen: boolean;
  onSelect: (template: PageTemplate) => void;
  onCancel: () => void;
}

export function TemplateDialog({ isOpen, onSelect, onCancel }: TemplateDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const blankTemplate = builtInTemplates.find((tpl) => tpl.id === 'blank');
  const otherTemplates = builtInTemplates.filter((tpl) => tpl.id !== 'blank');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-bg-main rounded-lg shadow-xl border border-border max-w-lg w-full mx-4 max-h-[80vh] flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="text-base font-semibold text-text-primary">
            {t('templates.dialogTitle')}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto">
          {/* Blank template - featured at top */}
          {blankTemplate && (
            <button
              onClick={() => onSelect(blankTemplate)}
              className="w-full text-left p-4 rounded-lg border border-border hover:border-accent hover:bg-bg-hover transition-colors mb-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img" aria-hidden="true">
                  {blankTemplate.icon}
                </span>
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {t(blankTemplate.nameKey)}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {t(blankTemplate.descriptionKey)}
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Other templates - 2 column grid */}
          <div className="grid grid-cols-2 gap-3">
            {otherTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="text-left p-4 rounded-lg border border-border hover:border-accent hover:bg-bg-hover transition-colors"
              >
                <span className="text-2xl mb-2 block" role="img" aria-hidden="true">
                  {template.icon}
                </span>
                <div className="text-sm font-medium text-text-primary">
                  {t(template.nameKey)}
                </div>
                <div className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {t(template.descriptionKey)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
