import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

function parseDisplayValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { numeric: raw, prefix: '', suffix: '', decimals: Number.isInteger(raw) ? 0 : 1 };
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  // Match a single clean numeric token with optional prefix/suffix (e.g. "54.0", "75.0%", "42.5j")
  const match = trimmed.match(/^([^\d\-+]*)(-?\d+(?:\.\d+)?)([^\d]*)$/);
  if (!match) {
    return null;
  }
  const num = Number(match[2]);
  if (!Number.isFinite(num)) {
    return null;
  }
  const decPart = match[2].split('.')[1];
  return {
    numeric: num,
    prefix: match[1] || '',
    suffix: match[3] || '',
    decimals: decPart ? decPart.length : 0,
  };
}

export function AnimatedNumber({ value, decimals, className }) {
  const prefersReducedMotion = useReducedMotion();
  const parsed = parseDisplayValue(value);

  const targetDecimals =
    typeof decimals === 'number' ? decimals : (parsed?.decimals ?? 0);

  const [displayNum, setDisplayNum] = useState(parsed ? parsed.numeric : null);
  const prevNumRef = useRef(parsed ? parsed.numeric : null);

  useEffect(() => {
    if (!parsed) {
      prevNumRef.current = null;
      setDisplayNum(null);
      return undefined;
    }

    const from = prevNumRef.current ?? parsed.numeric;
    const to = parsed.numeric;
    prevNumRef.current = to;

    if (prefersReducedMotion || from === to) {
      setDisplayNum(to);
      return undefined;
    }

    const controls = animate(from, to, {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayNum(latest);
      },
      onComplete: () => {
        setDisplayNum(to);
      },
    });

    return () => controls.stop();
  }, [parsed?.numeric, prefersReducedMotion]);

  if (!parsed || displayNum === null) {
    return <span className={cn('tabular-nums', className)}>{value}</span>;
  }

  return (
    <span className={cn('tabular-nums', className)}>
      {parsed.prefix}
      {displayNum.toFixed(targetDecimals)}
      {parsed.suffix}
    </span>
  );
}
