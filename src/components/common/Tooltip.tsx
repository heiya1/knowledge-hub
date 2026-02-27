import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setCoords(null);
  }, []);

  // Calculate position after visible + rendered
  useEffect(() => {
    if (!visible || !triggerRef.current) return;

    const calcPosition = () => {
      const trigger = triggerRef.current!;
      const rect = trigger.getBoundingClientRect();
      const pad = 8;
      const tooltipEl = tooltipRef.current;
      const tw = tooltipEl?.offsetWidth ?? 100;
      const th = tooltipEl?.offsetHeight ?? 28;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Try top first
      if (rect.top - th - pad > 0) {
        setPlacement('top');
        setCoords({
          top: rect.top - th - pad,
          left: Math.max(4, Math.min(vw - tw - 4, rect.left + rect.width / 2 - tw / 2)),
        });
        return;
      }

      // Try bottom
      if (rect.bottom + th + pad < vh) {
        setPlacement('bottom');
        setCoords({
          top: rect.bottom + pad,
          left: Math.max(4, Math.min(vw - tw - 4, rect.left + rect.width / 2 - tw / 2)),
        });
        return;
      }

      // Try right
      if (rect.right + tw + pad < vw) {
        setPlacement('right');
        setCoords({
          top: Math.max(4, Math.min(vh - th - 4, rect.top + rect.height / 2 - th / 2)),
          left: rect.right + pad,
        });
        return;
      }

      // Fallback left
      setPlacement('left');
      setCoords({
        top: Math.max(4, Math.min(vh - th - 4, rect.top + rect.height / 2 - th / 2)),
        left: Math.max(4, rect.left - tw - pad),
      });
    };

    // Need a frame for tooltipRef to be measured
    requestAnimationFrame(calcPosition);
  }, [visible]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!content) return <>{children}</>;

  const arrowClass = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-800 border-x-transparent border-b-transparent dark:border-t-neutral-200',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-800 border-x-transparent border-t-transparent dark:border-b-neutral-200',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-800 border-y-transparent border-r-transparent dark:border-l-neutral-200',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-neutral-800 border-y-transparent border-l-transparent dark:border-r-neutral-200',
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              zIndex: 9999,
              opacity: coords ? 1 : 0,
              pointerEvents: 'none',
            }}
            className="px-2 py-1 text-xs font-medium rounded bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 whitespace-nowrap shadow-lg"
          >
            {content}
            <span className={`absolute w-0 h-0 border-4 ${arrowClass[placement]}`} />
          </div>,
          document.body
        )}
    </>
  );
}
