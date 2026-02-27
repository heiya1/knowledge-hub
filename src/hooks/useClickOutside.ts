import { useEffect, useRef as useReactRef, type RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
  onClose: () => void
) {
  // Use ref for callback to avoid re-registering listener when onClose changes identity
  const onCloseRef = useReactRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isActive) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isActive, ref]);
}
