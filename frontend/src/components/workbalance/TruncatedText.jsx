import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const TOOLTIP_DELAY_MS = 150;

function isElementOverflowing(el) {
  if (!el) return false;
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

/**
 * Finds the first visibly truncated text node inside a table cell or header
 * and promotes native HTML `title` attributes on text elements to `data-full-text`
 * so the browser never renders a duplicate slow OS tooltip alongside our custom Tooltip.
 */
export function detectCellOverflowText(containerEl) {
  if (!containerEl) return '';

  // Promote native title attributes on non-interactive text nodes to prevent double tooltips
  const titledNodes = containerEl.querySelectorAll(
    'span[title], p[title], div[title]:not([role="separator"]):not([role="button"])'
  );
  for (const node of titledNodes) {
    const nativeTitle = node.getAttribute('title');
    if (nativeTitle) {
      node.setAttribute('data-full-text', nativeTitle);
      node.removeAttribute('title');
    }
  }

  // Check explicitly truncated descendants first (most reliable signal)
  const candidates = containerEl.querySelectorAll(
    '.truncate, [data-full-text], [class*="line-clamp-"]'
  );
  for (const node of candidates) {
    if (
      node.closest('button[data-slot="button"]') ||
      node.closest('[role="separator"]')
    ) {
      continue;
    }
    if (isElementOverflowing(node)) {
      const fullText = (
        node.getAttribute('data-full-text') ||
        node.textContent ||
        ''
      ).trim();
      if (fullText) return fullText;
    }
  }

  // Fallback: check the cell/header container itself
  if (isElementOverflowing(containerEl)) {
    const fallbackText = (containerEl.textContent || '').trim();
    if (fallbackText) return fallbackText;
  }

  return '';
}

/**
 * Smart truncated text primitive: automatically displays a styled WorkBalance
 * Tooltip ONLY when the rendered text is actually truncated ("...").
 */
export function TruncatedText({
  as: Component = 'span',
  text,
  children,
  side = 'top',
  align = 'start',
  className,
  ...props
}) {
  const ref = useRef(null);
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [fullText, setFullText] = useState('');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const handleOpenCheck = useCallback(() => {
    clearTimer();
    const el = ref.current;
    if (!el || !isElementOverflowing(el)) {
      setOpen(false);
      setFullText('');
      return;
    }
    const resolved = String(text ?? el.textContent ?? '').trim();
    if (!resolved) {
      setOpen(false);
      setFullText('');
      return;
    }
    setFullText(resolved);
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, TOOLTIP_DELAY_MS);
  }, [clearTimer, text]);

  const handleClose = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <Component
          ref={ref}
          onMouseEnter={handleOpenCheck}
          onMouseLeave={handleClose}
          onFocus={handleOpenCheck}
          onBlur={handleClose}
          onMouseDown={handleClose}
          className={cn('block min-w-0 truncate', className)}
          {...props}
        >
          {children ?? text}
        </Component>
      </TooltipTrigger>
      {open && fullText && (
        <TooltipContent
          side={side}
          align={align}
          sideOffset={6}
          className="max-w-sm whitespace-normal break-words px-3 py-2 text-xs leading-relaxed"
        >
          {fullText}
        </TooltipContent>
      )}
    </Tooltip>
  );
}
