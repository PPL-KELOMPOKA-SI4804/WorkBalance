import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  success: {
    pill: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  warning: {
    pill: 'border-amber-200/80 bg-amber-50/70 text-amber-800',
    dot: 'bg-amber-500',
  },
  danger: {
    pill: 'border-rose-200/80 bg-rose-50/70 text-rose-800',
    dot: 'bg-rose-500',
  },
  info: {
    pill: 'border-sky-200/80 bg-sky-50/70 text-sky-800',
    dot: 'bg-sky-500',
  },
  neutral: {
    pill: 'border-border bg-muted/60 text-muted-foreground',
    dot: 'bg-slate-400',
  },
};

const STATUS_PRESETS = {
  // Workload Risk
  low: { label: 'Risiko Rendah', tone: 'success' },
  medium: { label: 'Risiko Sedang', tone: 'warning' },
  high: { label: 'Risiko Tinggi', tone: 'danger' },
  override: { label: 'Override PP 35/2021', tone: 'danger' },

  // Decent Work Score
  good: { label: 'Baik', tone: 'success' },
  needs_attention: { label: 'Perlu Perhatian', tone: 'warning' },
  action_priority: { label: 'Prioritas Tindakan', tone: 'danger' },

  // Workflow & Approvals
  approved: { label: 'Disetujui', tone: 'success' },
  completed: { label: 'Selesai', tone: 'success' },
  resolved: { label: 'Selesai', tone: 'success' },
  active: { label: 'Aktif', tone: 'success' },

  pending: { label: 'Menunggu', tone: 'warning' },
  in_progress: { label: 'Ditangani', tone: 'warning' },

  open: { label: 'Terbuka', tone: 'info' },
  enrolled: { label: 'Terdaftar', tone: 'info' },
  planned: { label: 'Direncanakan', tone: 'info' },
  todo: { label: 'Belum Mulai', tone: 'info' },

  rejected: { label: 'Ditolak', tone: 'danger' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  inactive: { label: 'Nonaktif', tone: 'neutral' },
  severe: { label: 'Tinggi / Kritis', tone: 'danger' },
};

export function StatusBadge({
  status,
  tone,
  label,
  showDot = true,
  className,
}) {
  const key = typeof status === 'string' ? status.toLowerCase() : '';
  const preset = STATUS_PRESETS[key];
  const resolvedTone = tone || preset?.tone || 'neutral';
  const resolvedLabel = label || preset?.label || status || '-';
  const styles = TONE_CLASSES[resolvedTone] || TONE_CLASSES.neutral;

  return (
    <span
      data-slot="status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-4 whitespace-nowrap',
        styles.pill,
        className
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full', styles.dot)}
        />
      )}
      <span>{resolvedLabel}</span>
    </span>
  );
}
